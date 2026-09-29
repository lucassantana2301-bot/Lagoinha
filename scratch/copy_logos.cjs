const fs = require('fs');
const path = require('path');

const uploadedDir = 'C:\\Users\\alexa\\.gemini\\antigravity-ide\\brain\\da39dd55-7fa0-44b5-a19a-f70068610061\\.user_uploaded';
const targetDir = path.resolve(__dirname, '..', 'public', 'assets');

const logoSrc = path.join(uploadedDir, 'media_1790447522398.png');
const doveSrc = path.join(uploadedDir, 'media_1790447541116.png');

const logoDest = path.join(targetDir, 'lagoinha_alphaville_logo.png');
const doveDest = path.join(targetDir, 'lagoinha_dove_symbol.png');

if (fs.existsSync(logoSrc)) {
  fs.copyFileSync(logoSrc, logoDest);
  console.log(`Copied ${logoSrc} -> ${logoDest}`);
}
if (fs.existsSync(doveSrc)) {
  fs.copyFileSync(doveSrc, doveDest);
  console.log(`Copied ${doveSrc} -> ${doveDest}`);
}
