import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist',
      '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', err => console.error('ERR:', err.message));
  page.on('console', msg => { if (msg.type() === 'error') console.error('[console error]', msg.text()); });

  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle', timeout: 15000 });

  for (let i = 0; i < 40; i++) {
    const t = await page.$eval('#info', el => el.textContent);
    if (t.includes('click') || t.includes('Failed')) break;
    await new Promise(r => setTimeout(r, 250));
  }
  await new Promise(r => setTimeout(r, 2000));

  // Check deltaTime and force multiple update+render cycles
  const result = await page.evaluate(() => {
    const app = window.__sharedApp;
    const model = app.stage.children[0];
    if (!model) return { error: 'no model' };
    
    // Check automator state
    const automator = model.automator;
    return {
      deltaTime: model.deltaTime,
      autoUpdate: automator ? automator.autoUpdate : 'no automator',
      hasTicker: automator ? !!automator._ticker : 'no automator',
      tickerRunning: automator && automator._ticker ? automator._ticker.started : 'n/a',
    };
  });
  console.log('Model state:', JSON.stringify(result));

  // Force a tick + render
  await page.evaluate(() => {
    const app = window.__sharedApp;
    const model = app.stage.children[0];
    // Manually set deltaTime and render
    model.deltaTime = 0.016;
    model.elapsedTime = (model.elapsedTime || 0) + 0.016;
    app.render();
  });
  await new Promise(r => setTimeout(r, 200));
  await page.screenshot({ path: 'screenshots/force-tick-c2.png' });

  await browser.close();
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
