const fs = require('fs');
const path = require('path');
const vm = require('vm');

const jsDir = path.resolve(__dirname, '..', 'public', 'js');
const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));

console.log('Validating JS syntax for all client scripts:');
for (const file of files) {
  const filePath = path.join(jsDir, file);
  const code = fs.readFileSync(filePath, 'utf8');
  try {
    new vm.Script(code);
    console.log(`[PASS] ${file} (${code.length} bytes)`);
  } catch (err) {
    console.error(`[FAIL] ${file}: ${err.message}`);
  }
}
