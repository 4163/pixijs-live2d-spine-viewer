import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ]
    // NOTE: No --disable-http-cache this time
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push('[error] ' + msg.text());
    if (msg.type() === 'warning') errors.push('[warn] ' + msg.text());
  });
  page.on('pageerror', err => errors.push('PAGE ERR: ' + err.message));

  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle', timeout: 15000 });

  async function waitForLoad() {
    for (let i = 0; i < 60; i++) {
      const t = await page.$eval('#info', el => el.textContent);
      if (t.includes('click') || t.includes('Failed')) return t;
      await new Promise(r => setTimeout(r, 250));
    }
    return await page.$eval('#info', el => el.textContent);
  }

  let t = await waitForLoad();
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: 'screenshots/verify-c2.png' });
  console.log('C2:', t, '| errors:', errors.length > 0 ? errors : 'none');
  errors.length = 0;

  await page.selectOption('#model-select', 'classic_witch_c3');
  t = await waitForLoad();
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: 'screenshots/verify-c3.png' });
  console.log('C3:', t, '| errors:', errors.length > 0 ? errors : 'none');
  errors.length = 0;

  await page.selectOption('#mode-select', 'chibi');
  await new Promise(r => setTimeout(r, 3000));
  await page.selectOption('#mode-select', 'live2d');
  t = await waitForLoad();
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: 'screenshots/verify-switchback.png' });
  console.log('Switchback:', t, '| errors:', errors.length > 0 ? errors : 'none');

  await browser.close();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
