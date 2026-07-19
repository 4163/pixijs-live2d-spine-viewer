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

  // Read position BEFORE force render
  const before = await page.evaluate(() => {
    const m = window.__sharedApp.stage.children[0];
    return { x: m.x, y: m.y, sx: m.scale.x, sy: m.scale.y };
  });
  console.log('BEFORE render:', before);

  // Force a render
  await page.evaluate(() => window.__sharedApp.render());
  await new Promise(r => setTimeout(r, 100));

  // Read position AFTER force render  
  const after = await page.evaluate(() => {
    const m = window.__sharedApp.stage.children[0];
    return { x: m.x, y: m.y, sx: m.scale.x, sy: m.scale.y };
  });
  console.log('AFTER render:', after);

  await page.screenshot({ path: 'screenshots/dims-check.png' });

  // Now manually override position to center and render
  await page.evaluate(() => {
    const app = window.__sharedApp;
    const m = app.stage.children[0];
    m.x = (app.screen.width - m.width) / 2;
    m.y = (app.screen.height - m.height) / 2;
    app.render();
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: 'screenshots/dims-centered.png' });

  const final = await page.evaluate(() => {
    const m = window.__sharedApp.stage.children[0];
    return { x: m.x, y: m.y, sx: m.scale.x, sy: m.scale.y, w: m.width, h: m.height };
  });
  console.log('FINAL:', final);

  await browser.close();
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
