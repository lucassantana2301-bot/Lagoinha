const http = require('http');

function testUrl(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, length: data.length, contentType: res.headers['content-type'] });
      });
    }).on('error', (err) => {
      resolve({ error: err.message });
    });
  });
}

async function run() {
  console.log('Testing Static Assets & Endpoints on Port 3002:');
  const urls = [
    'http://localhost:3002/',
    'http://localhost:3002/css/style.css',
    'http://localhost:3002/js/app.js',
    'http://localhost:3002/js/icons.js',
    'http://localhost:3002/js/audio-effects.js',
    'http://localhost:3002/js/simulator.js',
    'http://localhost:3002/js/polygon-editor.js',
    'http://localhost:3002/js/detector-mock.js',
    'http://localhost:3002/assets/prototype_overview.jpg',
    'http://localhost:3002/assets/prototype_entrance.jpg',
    'http://localhost:3002/assets/prototype_editor.jpg',
    'http://localhost:3002/assets/satellite_lagoinha.jpg',
    'http://localhost:3002/api/state'
  ];

  for (const u of urls) {
    const res = await testUrl(u);
    console.log(`${u} => Status: ${res.status || 'ERR'}, Size: ${res.length || 0} bytes`);
  }
}

run();
