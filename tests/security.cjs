const fs = require('fs'), vm = require('vm'), assert = require('assert'), path = require('path'), os = require('os');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

function boot(env) {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lagoinha-'));
  let handler;
  const server = { listen(p, cb) { cb(); }, on() {} };
  vm.runInNewContext(source, {
    require(n) { if (n === 'http') return { createServer(h) { handler = h; return server; } }; return require(n); },
    __dirname: dataRoot, process: { env }, Buffer, URL, Date, setTimeout, console: { log() {}, error() {} }
  });
  return function req(url, body, headers = {}) {
    let status = 200, result, callbacks = {};
    const request = { url, headers: { host: 'localhost', ...headers }, method: body === undefined ? 'GET' : 'POST', on(k, v) { callbacks[k] = v; } };
    handler(request, { setHeader() {}, writeHead(s) { status = s; }, end(s) { result = s ? JSON.parse(s) : s; } });
    // Rejeições de autenticação respondem antes de ler o corpo.
    if (body !== undefined && callbacks.data) { callbacks.data(typeof body === 'string' ? body : JSON.stringify(body)); callbacks.end(); }
    return { status, result };
  };
}

const zone = { id: 'setor-x', name: 'Setor X', type: 'parking', color: '#22c55e', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] };

// Sem token configurado (uso local): escritas abertas, mas validadas.
let req = boot({});
assert.equal(req('/api/zones', {}).status, 400, 'objeto no lugar da lista de setores');
assert.equal(req('/api/zones', [{ ...zone, id: "x');alert(1)//" }]).status, 400, 'id com caracteres perigosos');
assert.equal(req('/api/zones', [{ ...zone, color: 'red"><img>' }]).status, 400, 'cor inválida');
assert.equal(req('/api/state').result.zones.length, 4, 'setores padrão preservados após payloads inválidos');
assert.equal(req('/api/zones', [zone]).status, 200);
assert.equal(req('/api/override', { sectorId: 'setor-x', status: '<script>' }).status, 400, 'status fora da lista');
assert.equal(req('/api/override', { sectorId: 'setor-x', status: 'blocked', volunteerName: 'x'.repeat(500) }).status, 200);
assert.equal(req('/api/state').result.sectors['setor-x'].humanOverride.volunteerName.length, 60, 'nome truncado');
assert.equal(req('/api/zones', 'x'.repeat(300 * 1024)).status, 413, 'corpo grande demais');
req('/api/telemetry', { producer: 'simulation', producerId: 'a', sectors: [{ id: 'setor-x', aiStatus: 'hacked', notes: 'n' }] });
assert.equal(req('/api/state').result.sectors['setor-x'].aiStatus, 'evaluating', 'status de telemetria inválido ignorado');
console.log('Segurança: validação de setores, overrides, telemetria e limite de corpo OK');

// Com token: escritas exigem o código; simulação continua pública.
req = boot({ VOLUNTEER_TOKEN: 'segredo' });
const auth = { authorization: 'Bearer segredo' };
assert.equal(req('/api/override', { sectorId: 'setor-a', status: 'blocked' }).status, 401);
assert.equal(req('/api/override', { sectorId: 'setor-a', status: 'blocked' }, { authorization: 'Bearer errado!' }).status, 401);
assert.equal(req('/api/override', { sectorId: 'setor-a', status: 'blocked' }, auth).status, 200);
assert.equal(req('/api/zones', [zone]).status, 401);
assert.equal(req('/api/zones', [zone], auth).status, 200);
assert.equal(req('/api/telemetry', { producer: 'detector', sectors: [] }).status, 401);
assert.equal(req('/api/telemetry', { producer: 'simulation', producerId: 'demo', sectors: [] }).status, 200);
assert.equal(req('/api/telemetry', { producer: 'detector', sectors: [] }, auth).status, 200);
console.log('Segurança: código de acesso da equipe nas escritas OK');

assert.throws(() => boot({ NODE_ENV: 'production' }), /VOLUNTEER_TOKEN/);
console.log('Segurança: produção sem VOLUNTEER_TOKEN recusada OK');
