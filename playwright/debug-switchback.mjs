import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  const errors = [];
  const logs = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
    else logs.push('[' + msg.type() + '] ' + msg.text());
  });
  page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message + '\n' + err.stack));

  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle', timeout: 15000 });
  
  for (let i = 0; i < 40; i++) {
    const t = await page.$eval('#info', el => el.textContent);
    if (t.includes('click to interact') || t.includes('Failed')) break;
    await new Promise(r => setTimeout(r, 250));
  }
  const info1 = await page.$eval('#info', el => el.textContent);
  console.log('AFTER L2D LOAD:', info1);
  console.log('ERRORS SO FAR:', JSON.stringify(errors));
  errors.length = 0; logs.length = 0;

  await page.selectOption('#mode-select', 'chibi');
  await new Promise(r => setTimeout(r, 3000));
  const info2 = await page.$eval('#info', el => el.textContent);
  console.log('AFTER CHIBI:', info2);

  await page.selectOption('#mode-select', 'live2d');
  await new Promise(r => setTimeout(r, 6000));
  const info3 = await page.$eval('#info', el => el.textContent);
  console.log('AFTER SWITCHBACK:', info3);
  console.log('ERRORS:', JSON.stringify(errors, null, 2));
  console.log('LOGS (last 30):', JSON.stringify(logs.slice(-30), null, 2));

  await browser.close();
}
run().catch(e => { console.error(e); process.exit(1); });
