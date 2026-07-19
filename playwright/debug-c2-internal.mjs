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

  const errors = [];
  const logs = [];
  page.on('pageerror', err => errors.push('ERR: ' + err.message));
  page.on('console', msg => {
    const t = '[' + msg.type() + '] ' + msg.text().substring(0, 300);
    logs.push(t);
    if (msg.type() === 'error' || msg.type() === 'warning') console.error(t);
  });

  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle', timeout: 15000 });

  for (let i = 0; i < 40; i++) {
    const t = await page.$eval('#info', el => el.textContent);
    if (t.includes('click') || t.includes('Failed')) break;
    await new Promise(r => setTimeout(r, 250));
  }
  await new Promise(r => setTimeout(r, 2000));

  // Inspect model internals
  const modelInfo = await page.evaluate(() => {
    const app = window.__sharedApp;
    if (!app || app.stage.children.length === 0) return { error: 'no model' };
    const model = app.stage.children[0];
    return {
      type: model.constructor.name,
      x: model.x, y: model.y,
      width: model.width, height: model.height,
      scaleX: model.scale.x, scaleY: model.scale.y,
      visible: model.visible,
      alpha: model.alpha,
      texturesCount: model.textures ? model.textures.length : 'n/a',
      texturesValid: model.textures ? model.textures.map(t => t.valid) : [],
      hasInternalModel: !!model.internalModel,
      internalModelType: model.internalModel ? model.internalModel.constructor.name : 'none',
      originalWidth: model.internalModel ? model.internalModel.originalWidth : 'n/a',
      originalHeight: model.internalModel ? model.internalModel.originalHeight : 'n/a',
    };
  });
  console.log('MODEL INFO:', JSON.stringify(modelInfo, null, 2));

  // Try force-rendering a few frames
  await page.evaluate(async () => {
    const app = window.__sharedApp;
    app.render();
    await new Promise(r => setTimeout(r, 16));
    app.render();
    await new Promise(r => setTimeout(r, 16));
    app.render();
  });

  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: 'screenshots/c2-internal.png' });
  console.log('Errors:', errors);
  console.log('All logs:', logs);

  await browser.close();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
