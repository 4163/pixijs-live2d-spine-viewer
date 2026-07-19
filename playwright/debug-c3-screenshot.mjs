import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

async function run() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-http-cache', '--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle', timeout: 15000 });

  // Wait for initial load
  for (let i = 0; i < 40; i++) {
    const t = await page.$eval('#info', el => el.textContent);
    if (t.includes('click') || t.includes('Failed')) break;
    await new Promise(r => setTimeout(r, 250));
  }

  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'screenshots/c3-debug-c2.png' });
  console.log('C2 screenshot taken');

  // Switch to C3 Default
  await page.selectOption('#model-select', 'm1903_5_normal');
  for (let i = 0; i < 60; i++) {
    const t = await page.$eval('#info', el => el.textContent);
    if (t.includes('click') || t.includes('Failed')) break;
    await new Promise(r => setTimeout(r, 250));
  }
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'screenshots/c3-debug-c3.png' });
  const info = await page.$eval('#info', el => el.textContent);
  console.log('C3 info:', info);
  console.log('C3 screenshot taken');

  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
