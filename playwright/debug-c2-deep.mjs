import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling'
    ]
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const responses = [];
  page.on('response', res => {
    if (res.status() >= 400) {
      responses.push({ status: res.status(), url: res.url() });
    }
  });

  const errors = [];
  const logs = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() !== 'log') return;
    logs.push(msg.text().substring(0, 200));
  });

  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle', timeout: 15000 });

  for (let i = 0; i < 40; i++) {
    const t = await page.$eval('#info', el => el.textContent);
    if (t.includes('click') || t.includes('Failed')) break;
    await new Promise(r => setTimeout(r, 250));
  }

  await new Promise(r => setTimeout(r, 3000));

  // Force a render frame  
  await page.evaluate(() => {
    if (window.__sharedApp) window.__sharedApp.render();
  });

  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: 'screenshots/trace-c2.png' });

  const info = await page.$eval('#info', el => el.textContent);
  console.log('Info:', info);
  console.log('404s:', JSON.stringify(responses, null, 2));
  console.log('Errors:', JSON.stringify(errors, null, 2));
  console.log('Logs:', JSON.stringify(logs, null, 2));

  // Check model state
  const modelState = await page.evaluate(() => {
    // Check if PIXI.live2d is defined and has Live2DModel
    const live2d = typeof PIXI !== 'undefined' && PIXI.live2d;
    return {
      pixiDefined: typeof PIXI !== 'undefined',
      live2dDefined: !!live2d,
      live2dModelDefined: !!(live2d && live2d.Live2DModel),
      stageChildren: window.__sharedApp ? window.__sharedApp.stage.children.length : -1,
      rendererType: window.__sharedApp ? window.__sharedApp.renderer.type : -1,
      canvasWidth: document.querySelector('canvas')?.width,
      canvasHeight: document.querySelector('canvas')?.height,
    };
  });
  console.log('Model state:', JSON.stringify(modelState, null, 2));

  await browser.close();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
