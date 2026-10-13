const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = process.cwd();
  const output = path.join(root,'.tools/site-qa');
  await fs.mkdir(output,{recursive:true});
  const server = http.createServer(async (req,res) => {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const filename = path.resolve(root,'.' + (pathname.endsWith('/') ? pathname+'index.html' : pathname));
    if (!filename.startsWith(root+path.sep)) {res.writeHead(403);res.end();return;}
    try {
      const content = await fs.readFile(filename);
      const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.ico':'image/x-icon'}[path.extname(filename)] || 'application/octet-stream';
      res.writeHead(200,{'Content-Type':mime});res.end(content);
    } catch {res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  const errors=[];
  const checks=[];
  try {
    browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {})});
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/pagead/js/adsbygoogle.js*',route=>route.abort());
    await page.goto(base+'/brochure-finder.html');
    await page.locator('#finder-brand').selectOption('Honda');
    await page.locator('#finder-model').selectOption('Honda CR-V');
    const catalog=JSON.parse(await fs.readFile(path.join(root,'data/brochures.json'),'utf8'));
    const expected=catalog.honda.filter(r=>r.section==='Honda CR-V').length;
    assert.equal(await page.locator('#finder-results tr').count(),expected);
    checks.push('Exact model filtering: '+expected+' CR-V records');
    for (let i=0;i<3;i++) await page.locator('#finder-results input').nth(i).check();
    assert.equal(await page.locator('#finder-selection article').count(),3);
    assert.equal(await page.locator('#finder-results input').nth(3).isDisabled(),true);
    const downloading=page.waitForEvent('download');
    await page.locator('#finder-export').click();
    const download=await downloading;
    const citation=path.join(output,'brochure-citations.txt');
    await download.saveAs(citation);
    assert.equal((await fs.readFile(citation,'utf8')).match(/Observed PDF page/g).length,3);
    await page.locator('#finder-clear').click();
    assert.equal(await page.locator('#finder-selection article').count(),0);
    checks.push('Selection limit, remove/clear and citation download');
    await page.locator('#finder-year').selectOption('2018');
    assert.equal(await page.locator('#finder-results tr').count(),1);
    await page.locator('#finder-query').fill('"><img src=x onerror=alert(1)>');
    assert.equal(await page.locator('#finder-results tr').count(),0);
    assert.equal(await page.locator('#finder-empty').isVisible(),true);
    checks.push('Combined year filter and safe empty search');
    await page.goto(base+'/brochure-finder.html');
    assert.equal(await page.locator('#finder-results tr').count(),40);
    await page.locator('#finder-more').click();
    assert.equal(await page.locator('#finder-results tr').count(),80);
    checks.push('Pagination and deep-link filtering');
    const recovery = JSON.parse(await fs.readFile(path.join(root,'data/indexing-recovery-targets.json'),'utf8'));
    const recoveryXml = await fs.readFile(path.join(root,'sitemap-recovery.xml'),'utf8');
    assert.equal([...recoveryXml.matchAll(/<loc>/g)].length,recovery.urls.length);
    assert.equal(recoveryXml.includes('/history/history/'),false);
    const redirectHtml = await fs.readFile(path.join(root,'history/history/index.html'),'utf8');
    assert(redirectHtml.includes('content="0; url=https://carbrochurearchive.com/history/"'));
    for (const [route,expectedPages] of [['/models/buick/buick-regal/',[14,18]],['/models/bmw/bmw-5-series-sedan/',[42]]]) {
      await page.goto(base+route);
      const checked = page.locator('section').filter({has:page.getByRole('heading',{name:'Checked PDF files',exact:true})});
      assert.equal(await checked.locator('img').count(),expectedPages.length);
      for (const pages of expectedPages) assert((await checked.innerText()).includes(String(pages)));
    }
    checks.push('Focused canonical sitemap, legacy redirect and checked PDF page counts');
    const views=[['home','/'],['finder','/brochure-finder.html?brand=Honda&q=CR-V'],['history','/history/bmw/'],['study','/research/honda-crv-2016-vs-2018/'],['model','/models/bmw/bmw-m6/'],['solterra','/models/subaru/subaru-solterra-electric/'],['gr-corolla','/models/toyota/toyota-corolla-gr/'],['bmw-range','/brands/bmw/'],['regal','/models/buick/buick-regal/'],['bmw-5-series','/models/bmw/bmw-5-series-sedan/']];
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:950});
      for (const [name,url] of views) {
        const response=await page.goto(base+url);
        assert.equal(response.status(),200,`${name} did not load`);
        await page.waitForTimeout(150);
        const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,badImages:[...document.images].filter(i=>i.complete && i.naturalWidth===0).map(i=>i.src)}));
        assert(metrics.scroll <= width+1,`${name} overflow at ${width}: ${metrics.scroll}`);
        assert.equal(metrics.badImages.length,0,`${name} missing images: ${metrics.badImages}`);
        await page.screenshot({path:path.join(output,`${name}-${width}.png`),fullPage:true});
      }
    }
    assert.equal(errors.length,0,errors.join('\n'));
    checks.push(`${views.length} views at desktop and mobile: HTTP 200, no horizontal page overflow, broken images or JS errors`);
    console.log(JSON.stringify({passed:true,checks},null,2));
    await fs.writeFile(path.join(root,'seo/browser-verification.json'),JSON.stringify({checkedOn:'2026-10-13',passed:true,checks},null,2));
  } finally {
    if(browser) await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
