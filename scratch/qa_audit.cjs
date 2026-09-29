const fs = require('fs');
const path = require('path');
const http = require('http');

const root = path.resolve(__dirname, '..');
const results = {
  html: {},
  css: {},
  js: {},
  endpoints: {},
  links: [],
  accessibility: {},
  errors: []
};

// 1. Inspect HTML
const htmlPath = path.join(root, 'public', 'index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Check anchors
const expectedAnchors = ['portal', 'visita', 'cultos', 'comunidade', 'participe', 'estacionamento', 'contato'];
results.html.anchorsFound = expectedAnchors.filter(a => htmlContent.includes(`id="${a}"`));
results.html.allAnchorsPresent = results.html.anchorsFound.length === expectedAnchors.length;

// Check images for alt, dimensions and lazy loading
const imgTags = htmlContent.match(/<img[^>]*>/gi) || [];
results.html.images = imgTags.map(tag => ({
  tag,
  hasAlt: /alt="[^"]+"/i.test(tag),
  hasLazy: /loading="lazy"/i.test(tag),
  hasWidth: /width="[^"]+"/i.test(tag),
  hasHeight: /height="[^"]+"/i.test(tag)
}));

// Check external links
const hrefMatches = [...htmlContent.matchAll(/href="([^"#][^"]+)"/g)].map(m => m[1]);
results.links = [...new Set(hrefMatches)];

// 2. Inspect CSS
const cssPath = path.join(root, 'public', 'css', 'style.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

results.css.hasSmoothScroll = /html\s*\{[^}]*scroll-behavior:\s*smooth/i.test(cssContent);
results.css.hasScrollMargin = /#portal[^{]*scroll-margin-top/i.test(cssContent);
results.css.hasReducedMotion = /prefers-reduced-motion:\s*reduce/i.test(cssContent);
results.css.has390Breakpoint = /max-width:\s*(390|480)px/i.test(cssContent);
results.css.has768Breakpoint = /max-width:\s*768px/i.test(cssContent);
results.css.has1050Breakpoint = /max-width:\s*1050px/i.test(cssContent);
results.css.hasDarkMode = /\[data-theme="dark"\]/i.test(cssContent);

// 3. Inspect JS
const jsPath = path.join(root, 'public', 'js', 'app.js');
const jsContent = fs.readFileSync(jsPath, 'utf8');

results.js.hasHashChangeListener = /window\.addEventListener\(['"]hashchange['"]/i.test(jsContent);
results.js.hasExperienceSwitcher = /function setExperience/i.test(jsContent);
results.js.hasActivateParkingApp = /window\.activateParkingApp/i.test(jsContent);
results.js.hasStaleSignalDetection = /simulator\.isSignalLost/i.test(jsContent);

console.log('=== QA AUTOMATED AUDIT REPORT ===');
console.log(JSON.stringify(results, null, 2));
