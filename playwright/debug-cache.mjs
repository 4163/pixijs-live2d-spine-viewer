// Playwright debug script — track model asset caching
// Usage:
//   1. Start server: npx live-server ../ --port=8000 --no-browser
//   2. Run: node playwright/debug-cache.mjs

import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const allReqs = [];
  const allResps = [];
  const errors = [];
  const logs = [];

  page.on('request', req => {
    allReqs.push({ step: 0, url: req.url(), method: req.method(), resource: req.resourceType() });
  });
  page.on('response', res => {
    allResps.push({ step: 0, url: res.url(), status: res.status(), cache: res.headers()['x-cache'] || '' });
  });
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
    logs.push('[' + msg.type() + '] ' + msg.text().substring(0, 300));
  });

  console.log('=== NAVIGATING ===');
  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle', timeout: 20000 });

  // Wait for first model to load
  for (let i = 0; i < 60; i++) {
    const t = await page.$eval('#info', el => el.textContent);
    if (t.includes('click') || t.includes('Failed') || t.includes('ready')) break;
    await new Promise(r => setTimeout(r, 250));
  }
  await new Promise(r => setTimeout(r, 2000));
  console.log('=== INITIAL LOAD DONE ===');
  const info0 = await page.$eval('#info', el => el.textContent);
  console.log('Info:', info0);

  // Mark requests from step 1
  const step1Count = allReqs.length;
  allReqs.forEach(r => r.step = 1);
  allResps.forEach(r => r.step = 1);

  // Find pills and click second one
  const pills = await page.$$('.model-pill');
  if (pills.length < 2) {
    console.log('ONLY', pills.length, 'PILLS — cannot test switching');
  } else {
    const pill2id = await pills[1].getAttribute('data-id');
    console.log('\n=== CLICKING PILL:', pill2id, '===');
    await pills[1].click();
    await new Promise(r => setTimeout(r, 5000));

    const info1 = await page.$eval('#info', el => el.textContent);
    console.log('Info after switch:', info1);

    // Mark requests from step 2
    allReqs.forEach(r => { if (!r.step) r.step = 2; });
    allResps.forEach(r => { if (!r.step) r.step = 2; });

    // Switch back to first model
    console.log('\n=== SWITCHING BACK TO FIRST MODEL ===');
    await pills[0].click();
    await new Promise(r => setTimeout(r, 5000));

    const info2 = await page.$eval('#info', el => el.textContent);
    console.log('Info after switch back:', info2);

    // Mark requests from step 3
    allReqs.forEach(r => { if (!r.step) r.step = 3; });
    allResps.forEach(r => { if (!r.step) r.step = 3; });
  }

  // Check cache state
  const cacheState = await page.evaluate(() => {
    if (typeof PIXI === 'undefined') return { pixi: 'missing' };
    var X = PIXI.live2d && PIXI.live2d.XHRLoader;
    if (!X) return { xhrLoader: 'missing' };
    return {
      hasLoadPatch: X.prototype.load.toString().includes('cache'),
      hasJSONPatch: X.prototype.loadJSON.toString().includes('cache'),
      method: typeof X.prototype.load
    };
  });
  console.log('\n=== CACHE PATCH STATE ===');
  console.log(JSON.stringify(cacheState, null, 2));

  // Show model file requests per step
  var modelRE = /\.(json|moc\d?|mtn|physics|pose|motion3|exp3?|cdi3|png|jpg|jpeg|webp|bmp|gif|skel|atlas)/i;
  console.log('\n=== MODEL FILE REQUESTS PER STEP ===');
  for (var step = 1; step <= 3; step++) {
    var stepReqs = allReqs.filter(function(r) {
      return r.step === step && modelRE.test(r.url) && !r.url.includes('localhost:8000/');
    });
    if (stepReqs.length > 0) {
      console.log('Step ' + step + ' (' + stepReqs.length + ' requests):');
      stepReqs.forEach(function(r) { console.log('  ' + r.url.replace(/^.*\/(models\/.*)$/, '$1')); });
    } else {
      console.log('Step ' + step + ': 0 model file requests ✓');
    }
  }

  // Show errors
  if (errors.length > 0) {
    console.log('\n=== ERRORS ===');
    errors.forEach(function(e) { console.log('  ' + e.substring(0, 200)); });
  }

  // Show last 20 console logs
  console.log('\n=== LAST 20 LOGS ===');
  logs.slice(-20).forEach(function(l) { console.log('  ' + l.substring(0, 300)); });

  await browser.close();
  console.log('\nDone.');
}

run().catch(e => { console.error(e); process.exit(1); });
