const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
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
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon'
};

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

  // CORS Headers for API flexibility
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

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

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      serverTime: now,
      videoSource: systemState.videoSource,
      telemetryOwner,
      detectorConnected,
      zones: loadZones(),
      sectors: systemState.sectors,
      overrides: systemState.volunteerOverrides
    }));
    return;
  }

  if (pathname === '/api/zones' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(loadZones()));
    return;
  }

  if (pathname === '/api/zones' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const zones = JSON.parse(body);
        saveZones(zones);
        refreshSectorState();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Polígonos atualizados com sucesso.' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'JSON inválido' }));
      }
    });
    return;
  }

  if (pathname === '/api/telemetry' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const now = Date.now();
        const isDemo = payload.producer === 'simulation';
        if (isDemo && (detectorConnected || (telemetryOwner && telemetryOwner !== payload.producerId && now - systemState.videoSource.lastFrameTimestamp < 20000))) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Outra fonte controla a telemetria.' }));
          return;
        }
        if (isDemo && !payload.producerId) throw new Error('Identificador da simulação obrigatório');
        if (!isDemo) detectorConnected = true;
        telemetryOwner = isDemo ? payload.producerId : 'detector';
        systemState.videoSource.lastFrameTimestamp = now;
        systemState.videoSource.fps = payload.fps || 10;
        systemState.videoSource.visibilityQuality = payload.visibilityQuality || 'good';
        if (payload.videoSource) {
          systemState.videoSource.name = payload.videoSource.name || systemState.videoSource.name;
          systemState.videoSource.type = payload.videoSource.type || systemState.videoSource.type;
        }

        // Update sectors from telemetry
        if (payload.sectors && Array.isArray(payload.sectors)) {
          payload.sectors.forEach(s => {
            if (systemState.sectors[s.id]) {
              systemState.sectors[s.id].detectedCarsCount = s.detectedCarsCount;
              systemState.sectors[s.id].lastUpdate = now;
              systemState.sectors[s.id].aiStatus = s.aiStatus;
              systemState.sectors[s.id].notes = s.notes || '';
              systemState.sectors[s.id].uncertaintyReason = s.uncertaintyReason || null;
            }
          });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, timestamp: now }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/override' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { sectorId, status, volunteerName, note } = JSON.parse(body);
        if (!systemState.sectors[sectorId]) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Setor não encontrado' }));
          return;
        }

        if (status === 'clear_override') {
          systemState.sectors[sectorId].humanOverride = null;
          delete systemState.volunteerOverrides[sectorId];
        } else {
          const overrideData = {
            status: status, // 'available' | 'full' | 'blocked'
            volunteerName: volunteerName || 'Voluntário Anônimo',
            timestamp: Date.now(),
            note: note || ''
          };
          systemState.sectors[sectorId].humanOverride = overrideData;
          systemState.volunteerOverrides[sectorId] = overrideData;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, sector: systemState.sectors[sectorId] }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Static File Serving
  let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);
  
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback for SPA routing if needed or 404
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 - Arquivo não encontrado');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

let currentPort = Number(PORT);

function startServer(portToTry) {
  server.listen(portToTry, () => {
    console.log(`====================================================`);
    console.log(`[Lagoinha Alphaville] Portal & Lagoinha Parking`);
    console.log(`Servidor ativo em: http://localhost:${portToTry}`);
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
