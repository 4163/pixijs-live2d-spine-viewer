import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-http-cache', '--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const errors = [];
  const logs = [];
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      errors.push('[' + msg.type() + '] ' + msg.text());
    } else {
      logs.push('[' + msg.type() + '] ' + msg.text());
    }
  });
  page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));

  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle', timeout: 15000 });

  // Wait up to 10s for initial load
  for (let i = 0; i < 40; i++) {
    const t = await page.$eval('#info', el => el.textContent);
    if (t.includes('click') || t.includes('Failed')) break;
    await new Promise(r => setTimeout(r, 250));
  }

  const info1 = await page.$eval('#info', el => el.textContent);
  console.log('INITIAL STATE:', info1);
  console.log('ERRORS:', JSON.stringify(errors, null, 2));
  console.log('LOGS:', JSON.stringify(logs.slice(0, 20), null, 2));

  // Try switching to C3 model
  errors.length = 0; logs.length = 0;
  await page.selectOption('#model-select', 'm1903_5_normal');
  for (let i = 0; i < 40; i++) {
    const t = await page.$eval('#info', el => el.textContent);
    if (t.includes('click') || t.includes('Failed')) break;
    await new Promise(r => setTimeout(r, 250));
  }

  const info2 = await page.$eval('#info', el => el.textContent);
  console.log('AFTER C3 SELECT:', info2);
  console.log('C3 ERRORS:', JSON.stringify(errors, null, 2));
  console.log('C3 LOGS (last 20):', JSON.stringify(logs.slice(-20), null, 2));

  await browser.close();
}

run().catch(e => { console.error(e); process.exit(1); });
