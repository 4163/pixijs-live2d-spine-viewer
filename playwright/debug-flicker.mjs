import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist',
      '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding']
  });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning')
      console.log(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => console.log('[PAGE_ERR]', err.message));

  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle', timeout: 15000 });
  await new Promise(r => setTimeout(r, 5000));
  console.log('Initial:', await page.evaluate(() => document.getElementById('info').textContent));

  // Capture frames — manually resize the window for ~6 seconds
  console.log('\nCapturing frames for 6 seconds — manually resize the window now!');
  const count = 360;
  for (let i = 0; i < count; i++) {
    const path = `screenshots/frame-${String(i).padStart(4, '0')}.png`;
    await page.screenshot({ path });
    if (i % 60 === 0) process.stdout.write('.');
    await new Promise(r => setTimeout(r, 16));
  }

  console.log('\n\nFrames captured. Analyzing...');
  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
