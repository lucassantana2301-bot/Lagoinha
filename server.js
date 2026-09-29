const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const PORT = process.env.PORT || 3000;
// Código da equipe exigido nas escritas (override, polígonos, detector). Sem ele, só uso local.
const VOLUNTEER_TOKEN = process.env.VOLUNTEER_TOKEN || '';
if (!VOLUNTEER_TOKEN && process.env.NODE_ENV === 'production') {
  throw new Error('Defina VOLUNTEER_TOKEN para rodar em produção.');
}
const DATA_DIR = path.join(__dirname, 'data');
const ZONES_FILE = path.join(DATA_DIR, 'zones.json');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Default sectors configuration (Fictitious representative layout for testing)
const DEFAULT_ZONES = [
  {
    id: "setor-a",
    name: "Setor A (Entrada / Frontal)",
    type: "parking",
    color: "#22c55e",
    points: [
      { x: 0.05, y: 0.35 },
      { x: 0.42, y: 0.35 },
      { x: 0.40, y: 0.78 },
      { x: 0.03, y: 0.78 }
    ],
    maxEstimatedCapacity: 12,
    confidenceThreshold: 0.65
  },
  {
    id: "setor-b",
    name: "Setor B (Fundos / Lateral)",
    type: "parking",
    color: "#3b82f6",
    points: [
      { x: 0.58, y: 0.20 },
      { x: 0.95, y: 0.20 },
      { x: 0.95, y: 0.65 },
      { x: 0.58, y: 0.65 }
    ],
    maxEstimatedCapacity: 16,
    confidenceThreshold: 0.70
  },
  {
    id: "corredor-central",
    name: "Corredor Central de Manobra",
    type: "corridor",
    color: "#eab308",
    points: [
      { x: 0.43, y: 0.15 },
      { x: 0.57, y: 0.15 },
      { x: 0.57, y: 0.95 },
      { x: 0.43, y: 0.95 }
    ],
    maxEstimatedCapacity: 0,
    confidenceThreshold: 0.85
  },
  {
    id: "area-bloqueada",
    name: "Área de Embarque & Emergência",
    type: "restricted",
    color: "#ef4444",
    points: [
      { x: 0.05, y: 0.15 },
      { x: 0.42, y: 0.15 },
      { x: 0.42, y: 0.32 },
      { x: 0.05, y: 0.32 }
    ],
    maxEstimatedCapacity: 0,
    confidenceThreshold: 0.90
  }
];

// Initialize zones file if missing
if (!fs.existsSync(ZONES_FILE)) {
  fs.writeFileSync(ZONES_FILE, JSON.stringify(DEFAULT_ZONES, null, 2), 'utf-8');
}

// In-Memory State
let telemetryOwner = null;
let detectorConnected = false;
let systemState = {
  videoSource: {
    type: "simulation", // 'simulation' | 'local_video' | 'rtsp_stream'
    name: "Simulação de Demonstração (Sintética)",
    active: true,
    lastFrameTimestamp: Date.now(),
    fps: 10,
    resolution: "1280x720",
    visibilityQuality: "good" // 'good' | 'medium' | 'poor' | 'offline'
  },
  sectors: {},
  volunteerOverrides: {},
  telemetryLogs: []
};

// Helper: load zones
function loadZones() {
  try {
    const raw = fs.readFileSync(ZONES_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error loading zones:', err);
    return DEFAULT_ZONES;
  }
}

// Helper: save zones
function saveZones(zones) {
  fs.writeFileSync(ZONES_FILE, JSON.stringify(zones, null, 2), 'utf-8');
}

// Initialize sector state from zones
function refreshSectorState() {
  const zones = loadZones();
  zones.forEach(zone => {
    if (!systemState.sectors[zone.id]) {
      systemState.sectors[zone.id] = {
        id: zone.id,
        name: zone.name,
        type: zone.type,
        color: zone.color,
        detectedCarsCount: 0,
        lastUpdate: Date.now(),
        aiStatus: "evaluating", // 'available_probable' | 'moderate' | 'full' | 'uncertain' | 'offline'
        humanOverride: null, // null | { status: 'available' | 'full' | 'blocked', volunteerName: 'Marcos', timestamp: ... }
        notes: "Aguardando primeiros dados de telemetria...",
        uncertaintyReason: null
      };
    }
  });
}
refreshSectorState();

// MIME Types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon'
};
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.svg']);

const MAX_BODY_BYTES = 256 * 1024;
const SECTOR_STATUSES = new Set(['evaluating', 'clear', 'available_probable', 'moderate', 'full', 'uncertain', 'offline']);
const OVERRIDE_STATUSES = new Set(['available', 'full', 'blocked', 'clear_override']);
const ZONE_TYPES = new Set(['parking', 'corridor', 'restricted']);

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readJson(req, res, onBody) {
  let body = '';
  let tooLarge = false;
  req.on('data', chunk => {
    if (tooLarge) return;
    body += chunk;
    if (body.length > MAX_BODY_BYTES) {
      tooLarge = true;
      sendJson(res, 413, { success: false, error: 'Corpo da requisição muito grande' });
    }
  });
  req.on('end', () => {
    if (tooLarge) return;
    let payload;
    try {
      payload = JSON.parse(body);
    } catch (err) {
      sendJson(res, 400, { success: false, error: 'JSON inválido' });
      return;
    }
    try {
      onBody(payload || {});
    } catch (err) {
      sendJson(res, 400, { success: false, error: err.message });
    }
  });
}

function isAuthorized(req) {
  if (!VOLUNTEER_TOKEN) return true;
  const expected = Buffer.from(`Bearer ${VOLUNTEER_TOKEN}`);
  const received = Buffer.from(String(req.headers.authorization || ''));
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

function text(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function unitNumber(value) {
  return typeof value === 'number' && value >= 0 && value <= 1;
}

function validateZones(zones) {
  if (!Array.isArray(zones) || zones.length > 50) throw new Error('Lista de setores inválida');
  const ids = new Set();
  return zones.map(zone => {
    if (!zone || !/^[a-z0-9-]{1,64}$/.test(zone.id) || ids.has(zone.id)) throw new Error('Identificador de setor inválido');
    ids.add(zone.id);
    if (!ZONE_TYPES.has(zone.type)) throw new Error(`Tipo inválido no setor ${zone.id}`);
    const name = text(zone.name, 80);
    if (!name) throw new Error(`Nome ausente no setor ${zone.id}`);
    if (!/^#[0-9a-f]{6}$/i.test(zone.color)) throw new Error(`Cor inválida no setor ${zone.id}`);
    if (!Array.isArray(zone.points) || zone.points.length < 3 || zone.points.length > 100 ||
        !zone.points.every(p => p && unitNumber(p.x) && unitNumber(p.y))) {
      throw new Error(`Polígono inválido no setor ${zone.id}`);
    }
    const capacity = Number.isInteger(zone.maxEstimatedCapacity) && zone.maxEstimatedCapacity >= 0 && zone.maxEstimatedCapacity <= 1000
      ? zone.maxEstimatedCapacity : 0;
    return {
      id: zone.id,
      name,
      type: zone.type,
      color: zone.color,
      points: zone.points.map(p => ({ x: p.x, y: p.y })),
      maxEstimatedCapacity: capacity,
      confidenceThreshold: unitNumber(zone.confidenceThreshold) ? zone.confidenceThreshold : 0.7
    };
  });
}

function serveStatic(req, res, pathname) {
  const publicDir = path.join(__dirname, 'public');
  const filePath = path.join(publicDir, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(publicDir + path.sep)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 - Arquivo não encontrado');
    return;
  }
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 - Arquivo não encontrado');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const etag = `W/"${stats.size}-${Math.floor(stats.mtimeMs)}"`;
    // Nomes de arquivo sem hash: HTML/CSS/JS sempre revalidam via ETag; imagens ficam em cache por um dia.
    const headers = {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' || ext === '.css' || ext === '.js' ? 'no-cache' : 'public, max-age=86400',
      'ETag': etag
    };
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
    const stream = fs.createReadStream(filePath);
    if (COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      headers['Content-Encoding'] = 'gzip';
      headers['Vary'] = 'Accept-Encoding';
      res.writeHead(200, headers);
      stream.pipe(zlib.createGzip()).pipe(res);
      return;
    }
    headers['Content-Length'] = stats.size;
    res.writeHead(200, headers);
    stream.pipe(res);
  });
}

const server = http.createServer((req, res) => {
  let parsedUrl;
  try {
    parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request');
    return;
  }
  const pathname = parsedUrl.pathname;

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // API Endpoints
  if (pathname === '/api/state' && req.method === 'GET') {
    // Check Watchdog for Stale Frame
    const now = Date.now();
    for (const sector of Object.values(systemState.sectors)) {
      if (sector.humanOverride && now - sector.humanOverride.timestamp > 300000) {
        sector.humanOverride = null;
        delete systemState.volunteerOverrides[sector.id];
      }
    }
    const frameAgeSeconds = (now - systemState.videoSource.lastFrameTimestamp) / 1000;

    // If no frame received for > 20s, flag stream offline
    if (frameAgeSeconds > 20 && systemState.videoSource.active) {
      systemState.videoSource.visibilityQuality = 'offline';
      Object.keys(systemState.sectors).forEach(id => {
        systemState.sectors[id].aiStatus = 'offline';
        systemState.sectors[id].uncertaintyReason = 'Câmera sem sinal ou frame estagnado há mais de 20s.';
      });
    }

    sendJson(res, 200, {
      serverTime: now,
      videoSource: systemState.videoSource,
      telemetryOwner,
      detectorConnected,
      zones: loadZones(),
      sectors: systemState.sectors,
      overrides: systemState.volunteerOverrides
    });
    return;
  }

  if (pathname === '/api/zones' && req.method === 'GET') {
    sendJson(res, 200, loadZones());
    return;
  }

  if (pathname === '/api/zones' && req.method === 'POST') {
    if (!isAuthorized(req)) {
      sendJson(res, 401, { success: false, error: 'Código de acesso da equipe inválido' });
      return;
    }
    readJson(req, res, payload => {
      saveZones(validateZones(payload));
      refreshSectorState();
      sendJson(res, 200, { success: true, message: 'Polígonos atualizados com sucesso.' });
    });
    return;
  }

  if (pathname === '/api/telemetry' && req.method === 'POST') {
    readJson(req, res, payload => {
      const now = Date.now();
      const isDemo = payload.producer === 'simulation';
      // A simulação é pública (demonstração); só o detector real precisa do código da equipe.
      if (!isDemo && !isAuthorized(req)) {
        sendJson(res, 401, { success: false, error: 'Código de acesso da equipe inválido' });
        return;
      }
      if (isDemo && (detectorConnected || (telemetryOwner && telemetryOwner !== payload.producerId && now - systemState.videoSource.lastFrameTimestamp < 20000))) {
        sendJson(res, 409, { error: 'Outra fonte controla a telemetria.' });
        return;
      }
      if (isDemo && !text(payload.producerId, 64)) throw new Error('Identificador da simulação obrigatório');
      if (!isDemo) detectorConnected = true;
      telemetryOwner = isDemo ? text(payload.producerId, 64) : 'detector';

      systemState.videoSource.lastFrameTimestamp = now;
      systemState.videoSource.fps = typeof payload.fps === 'number' ? payload.fps : 10;
      systemState.videoSource.visibilityQuality = ['good', 'medium', 'poor'].includes(payload.visibilityQuality) ? payload.visibilityQuality : 'good';

      if (payload.videoSource) {
        systemState.videoSource.name = text(payload.videoSource.name, 120) || systemState.videoSource.name;
        systemState.videoSource.type = text(payload.videoSource.type, 32) || systemState.videoSource.type;
      }

      if (Array.isArray(payload.sectors)) {
        payload.sectors.forEach(s => {
          const sector = s && systemState.sectors[s.id];
          if (!sector || !SECTOR_STATUSES.has(s.aiStatus)) return;
          sector.detectedCarsCount = Number.isInteger(s.detectedCarsCount) && s.detectedCarsCount >= 0 ? s.detectedCarsCount : null;
          sector.lastUpdate = now;
          sector.aiStatus = s.aiStatus;
          sector.notes = text(s.notes, 200);
          sector.uncertaintyReason = text(s.uncertaintyReason, 200) || null;
        });
      }

      sendJson(res, 200, { success: true, timestamp: now });
    });
    return;
  }

  if (pathname === '/api/override' && req.method === 'POST') {
    if (!isAuthorized(req)) {
      sendJson(res, 401, { success: false, error: 'Código de acesso da equipe inválido' });
      return;
    }
    readJson(req, res, ({ sectorId, status, volunteerName, note }) => {
      if (!systemState.sectors[sectorId]) {
        sendJson(res, 404, { success: false, error: 'Setor não encontrado' });
        return;
      }
      if (!OVERRIDE_STATUSES.has(status)) throw new Error('Status inválido');

      if (status === 'clear_override') {
        systemState.sectors[sectorId].humanOverride = null;
        delete systemState.volunteerOverrides[sectorId];
      } else {
        const overrideData = {
          status,
          volunteerName: text(volunteerName, 60) || 'Voluntário Anônimo',
          timestamp: Date.now(),
          note: text(note, 200)
        };
        systemState.sectors[sectorId].humanOverride = overrideData;
        systemState.volunteerOverrides[sectorId] = overrideData;
      }

      sendJson(res, 200, { success: true, sector: systemState.sectors[sectorId] });
    });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { success: false, error: 'Método não permitido' });
    return;
  }

  serveStatic(req, res, pathname);
});

let currentPort = Number(PORT);

function startServer(portToTry) {
  server.listen(portToTry, () => {
    console.log(`====================================================`);
    console.log(`[Lagoinha Alphaville] Portal & Lagoinha Parking`);
    console.log(`Servidor ativo em: http://localhost:${portToTry}`);
    if (!VOLUNTEER_TOKEN) console.log('Aviso: VOLUNTEER_TOKEN não definido — escritas abertas (apenas uso local).');
    console.log(`====================================================`);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    currentPort += 1;
    console.log(`Porta ocupada. Tentando porta alternativa ${currentPort}...`);
    setTimeout(() => {
      startServer(currentPort);
    }, 200);
  } else {
    console.error('Erro no servidor:', err);
  }
});

startServer(currentPort);
