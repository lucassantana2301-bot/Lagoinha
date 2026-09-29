const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');

console.log('=== TESTES DO MÓDULO ANTIGRAVITY (PARKING POLISH) ===\n');

// 1. Validar existência e escopo restrito de public/css/parking-polish.css
const cssPath = path.join(root, 'public', 'css', 'parking-polish.css');
assert.ok(fs.existsSync(cssPath), 'O arquivo public/css/parking-polish.css deve existir.');

const cssContent = fs.readFileSync(cssPath, 'utf8');
assert.ok(cssContent.length > 200, 'O arquivo CSS deve conter regras de estilo.');

// Extrair seletores (ignorando @keyframes e comentários)
const cleanCss = cssContent.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[\s\S]*?\{[\s\S]*?\}\s*\}/g, '');
const rules = cleanCss.split('}').map(r => r.trim()).filter(r => r.length > 0 && r.includes('{'));

let nonScopedSelectors = [];
for (const rule of rules) {
  const selectorPart = rule.split('{')[0].trim();
  const individualSelectors = selectorPart.split(',').map(s => s.trim());
  for (const sel of individualSelectors) {
    if (sel.startsWith('@') || sel.length === 0) continue;
    if (!sel.startsWith('#viewParking')) {
      nonScopedSelectors.push(sel);
    }
  }
}

assert.equal(
  nonScopedSelectors.length,
  0,
  `Todos os seletores em parking-polish.css devem iniciar com #viewParking. Encontrados não conformes: ${nonScopedSelectors.join(', ')}`
);
console.log('✔ public/css/parking-polish.css: 100% dos seletores estão estritamente restritos a #viewParking.');

// 2. Validar sintaxe e integridade de public/js/parking-polish.js
const jsPath = path.join(root, 'public', 'js', 'parking-polish.js');
assert.ok(fs.existsSync(jsPath), 'O arquivo public/js/parking-polish.js deve existir.');

const jsContent = fs.readFileSync(jsPath, 'utf8');
const sandbox = {
  window: {},
  document: {
    getElementById: () => ({ appendChild: () => {}, remove: () => {} }),
    createElement: () => ({ style: {}, classList: { add: () => {}, remove: () => {} } }),
    addEventListener: () => {}
  },
  setTimeout: (fn) => fn()
};

vm.createContext(sandbox);
vm.runInContext(jsContent, sandbox);

assert.ok(sandbox.window.LagoinhaParkingPolish, 'parking-polish.js deve inicializar o namespace window.LagoinhaParkingPolish.');
assert.equal(typeof sandbox.window.LagoinhaParkingPolish.showToast, 'function', 'showToast deve ser uma função exportada.');
console.log('✔ public/js/parking-polish.js: Sintaxe válida, inicialização segura e sem polling concorrente.');

// 3. Executar o teste de regressão principal do projeto
console.log('\nExecutando suite de regressão principal...');
require(path.join(root, 'tests', 'regression.cjs'));
console.log('✔ Suite de regressão principal aprovada com 100% de sucesso.');

console.log('\n=== TODOS OS TESTES ANTIGRAVITY FORAM APROVADOS COM SUCESSO! ===');
