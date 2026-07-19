import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  // Capture all failed requests
  const failed = [];
  page.on('requestfailed', req => failed.push({ url: req.url(), failure: req.failure()?.errorText }));
  page.on('response', res => { if (res.status() >= 400) failed.push({ url: res.url(), status: res.status() }); });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle', timeout: 15000 });

  for (let i = 0; i < 40; i++) {
    const t = await page.$eval('#info', el => el.textContent);
    if (t.includes('click') || t.includes('Failed')) break;
    await new Promise(r => setTimeout(r, 250));
  }
  await new Promise(r => setTimeout(r, 2000));

  console.log('FAILED REQUESTS:', JSON.stringify(failed, null, 2));
  console.log('PAGE ERRORS:', JSON.stringify(errors, null, 2));

  await browser.close();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
