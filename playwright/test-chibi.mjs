import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-http-cache', '--no-sandbox']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });
  // Capture stack traces via page injection
  await page.evaluate(() => {
    window.__errors = [];
    window.addEventListener('error', function(e) {
      window.__errors.push({
        type: 'error',
        msg: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        stack: e.error?.stack
      });
    });
    window.addEventListener('unhandledrejection', function(e) {
      window.__errors.push({
        type: 'unhandledrejection',
        msg: e.reason?.message || String(e.reason),
        stack: e.reason?.stack
      });
    });
  });
  page.on('pageerror', err => {
    consoleLogs.push(`[PAGE_ERROR] ${err.message}`);
    try { consoleLogs.push(`  Stack: ${err.stack?.split('\n').slice(0, 5).join('\n  ') || '(no stack)'}`); } catch(e) {}
  });
  // Log ALL responses including status
  const seen = new Set();
  page.on('response', async resp => {
    const url = resp.url();
    if (seen.has(url)) return;
    seen.add(url);
    consoleLogs.push(`[HTTP ${resp.status()}] ${resp.request().method()} ${url}`);
  });

  console.log('Opening viewer...');
  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);

  // Check initial mode
  let mode = await page.$eval('#mode-select', el => el.value);
  console.log(`Initial mode: ${mode}`);

  // Screenshot Live2D
  await page.screenshot({ path: 'chibi-live2d.png' });

  // Switch to Chibi
  console.log('Switching to Chibi...');
  await page.selectOption('#mode-select', 'chibi');
  await page.waitForTimeout(5000);

  // Check info text after mode switch
  let infoText = await page.$eval('#info', el => el.textContent);
  console.log(`Chibi info: ${infoText}`);

  let mode2 = await page.$eval('#mode-select', el => el.value);
  console.log(`Mode: ${mode2}`);

  // Screenshot Chibi
  await page.screenshot({ path: 'chibi-chibi.png' });

  if (infoText.includes('cycle animation') || infoText.includes('animations')) {
    console.log('✓ Chibi mode loaded successfully');
  } else {
    console.log('✗ Chibi mode may have failed');
  }

  // Click the chibi multiple times to cycle animations
  // Chibi is positioned at (screen.width/2, screen.height*0.9) ≈ (640, 648)
  console.log('\nClicking chibi to cycle animations...');
  for (let i = 0; i < 3; i++) {
    await page.click('canvas', { position: { x: 640, y: 650 } });
    await page.waitForTimeout(500);
    infoText = await page.$eval('#info', el => el.textContent);
    console.log(`  After click ${i + 1}: ${infoText}`);
  }

  // Switch back to Live2D AFTER cycling chibi animations
  console.log('\nSwitching back to Live2D after cycling chibi anims...');
  await page.selectOption('#mode-select', 'live2d');
  await page.waitForTimeout(5000);

  infoText = await page.$eval('#info', el => el.textContent);
  console.log(`Live2D info: ${infoText}`);

  mode2 = await page.$eval('#mode-select', el => el.value);
  console.log(`Mode: ${mode2}`);

  await page.screenshot({ path: 'chibi-backtolive2d.png' });

  // Print logs
  console.log('\n=== CONSOLE LOGS ===');
  consoleLogs.forEach(l => console.log(l));

  // Dump captured errors with stacks
  const captured = await page.evaluate(() => window.__errors || []);
  if (captured.length) {
    console.log('\n=== CAPTURED ERRORS ===');
    captured.forEach(e => {
      console.log(`  ${e.msg}`);
      if (e.filename) console.log(`  at ${e.filename}:${e.lineno}:${e.colno}`);
      if (e.stack) console.log(`  ${e.stack.split('\n').slice(0, 4).join('\n  ')}`);
    });
  }

  const errors = consoleLogs.filter(l => l.includes('error') || l.includes('Error') || l.includes('[PAGE_ERROR]'));
  if (errors.length > 0) {
    console.log(`\n=== ${errors.length} ERRORS ===`);
    errors.forEach(e => console.log(`  ${e}`));
  } else {
    console.log('\n=== NO ERRORS ===');
  }

  await browser.close();
  process.exit(0);
}

run().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
