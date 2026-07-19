import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist',
      '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle', timeout: 15000 });

  for (let i = 0; i < 40; i++) {
    const t = await page.$eval('#info', el => el.textContent);
    if (t.includes('click') || t.includes('Failed')) break;
    await new Promise(r => setTimeout(r, 250));
  }
  await new Promise(r => setTimeout(r, 1000));

  const boundsInfo = await page.evaluate(() => {
    const app = window.__sharedApp;
    const model = app.stage.children[0];
    if (!model) return { error: 'no model' };
    
    let drawableBounds = null;
    try {
      drawableBounds = model.internalModel.getDrawableBounds();
    } catch (e) {
      drawableBounds = e.message;
    }
    
    return {
      width: model.width,
      height: model.height,
      originalWidth: model.internalModel.originalWidth,
      originalHeight: model.internalModel.originalHeight,
      drawableBounds: drawableBounds
    };
  });
  
  console.log('Bounds info:', JSON.stringify(boundsInfo, null, 2));

  await browser.close();
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
