const { chromium } = require('playwright-core');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 1000 } });
  await page.goto('http://localhost:8000/');
  await page.waitForTimeout(1000);
  await page.click('.btn-login');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'c:\\Jakdoo\\screenshot_admin_dash.png', fullPage: true });
  await browser.close();
})();
