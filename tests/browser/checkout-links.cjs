// Run after npm run build: node tests/browser/checkout-links.cjs
// Uses mocked APIs and a disposable browser; no member data is changed.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '../..');
fs.mkdirSync(path.join(root, 'tmp'), {recursive:true});
const rails = path.resolve(root, '../makerspace-rails-2026');
const id = '0123456789abcdef01234567';
const html = '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0" /><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/assets/makerspace-react.css"><script defer src="/assets/makerspace-react.js"></script></head><body></body></html>';
const server = http.createServer((req,res) => {
  const url = req.url.split('?')[0];
  let file;
  if(url === '/public-tool-preview.html') file=path.join(rails,'tmp',url);
  else if(url === '/public_catalog.css' || url === '/FilledLaserableLogo.svg') file=path.join(rails,'tmp',url);
  else if(url === '/assets/FilledLaserableLogo.svg') file=path.join(rails,'app/assets/images/FilledLaserableLogo.svg');
  else if(url.startsWith('/assets/')) file=path.join(root,'dist',url.slice(8));
  if(file && fs.existsSync(file)) {
    res.setHeader('Content-Type', file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.svg')?'image/svg+xml':'text/html');
    res.end(fs.readFileSync(file));
  } else {res.setHeader('Content-Type','text/html');res.end(html);}
});
(async()=>{
 await new Promise(resolve=>server.listen(8765,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),headless:true});
 try {
  const loginPage = await browser.newPage();
  let authenticated = false;
  await loginPage.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    let body = {}, status = 200;
    const member = {id:'member1',email:'test@example.com',firstname:'Test',lastname:'Member',role:'member',status:'activeMember'};
    if(url.pathname === '/api/members/sign_in') {
      const params = route.request().postDataJSON();
      if(authenticated) body = member;
      else if(params.member) {status=202;body={totp_required:true};}
      else {status=401;body={error:'Sign in required'};}
    } else if(url.pathname === '/api/members/totp_sessions') {authenticated=true;body=member;}
    else if(url.pathname.endsWith('/coreq.html')) body={tool:{id,name:'Saw',unmetPrerequisiteNames:[]},eligible:true};
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  await loginPage.goto(`http://127.0.0.1:8765/tools/${id}/request-checkout`);
  await loginPage.getByRole('button',{name:'Sign In',exact:true}).waitFor();
  assert(loginPage.url().includes('return_to='));
  await loginPage.getByRole('textbox',{name:'Email',exact:true}).fill('test@example.com');
  await loginPage.getByLabel('Password',{exact:false}).fill('Password123');
  await loginPage.getByRole('button',{name:'Sign In',exact:true}).click();
  await loginPage.getByLabel('Authentication Code').fill('123456');
  await loginPage.getByRole('button',{name:'Verify',exact:true}).click();
  await loginPage.getByRole('dialog').waitFor().catch(async error=>{console.log('LOGIN URL',loginPage.url(),'BODY',await loginPage.locator('body').innerText());throw error;});
  assert(loginPage.url().endsWith(`/tools/${id}/request-checkout`));
  console.log('PASS password + TOTP login returns to selected tool');
  await loginPage.close();
  for(const width of [320,600,900,1440]) {
   const page=await browser.newPage({viewport:{width,height:900}});
   page.on("pageerror", error=>console.log("PAGE ERROR",error.stack));
   let posts=0;
   let eligible=true;
   await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url());
    let body={};
    if(url.pathname==='/api/members/sign_in') body={id:'member1',firstname:'Test',lastname:'Member',fullname:'Test Member',email:'test@example.com',role:'member',status:'activeMember',expirationTime:'2099-01-01'};
    else if(url.pathname.includes('/permissions')) body={};
    else if(url.pathname.endsWith('/coreq.html')) body={tool:{id,name:'Table saw with a long descriptive name',description:'Read the tool wiki before use.',unmetPrerequisiteNames:['Workshop introduction']},eligible,reason:eligible?null:'No checkout required'};
    else if(url.pathname==='/api/tool_checkout_requests') {posts++;body={id:'request1'};}
    await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
   });
   await page.goto(`http://127.0.0.1:8765/tools/${id}/request-checkout`);
   await page.getByRole('dialog').waitFor().catch(async error=>{console.log('URL',page.url(),'BODY',await page.locator('body').innerText()); throw error;});
   assert.equal(posts,0,'GET must not submit');
   await page.getByRole('textbox',{name:'Note'}).focus();
   await page.keyboard.type('Please arrange a checkout.');
   await page.evaluate(()=>document.fonts.ready);
   await page.screenshot({path:path.join(root,`tmp/checkout-${width}.png`),fullPage:true});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow');
   const box=await page.getByRole('dialog').boundingBox();
   assert(box.x>=0 && box.x+box.width<=width,'dialog overflow');
   await page.keyboard.press('Tab');
   assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Submit Request');
   await page.keyboard.press('Enter');
   await page.getByText('Checkout request submitted.').waitFor();
   assert.equal(posts,1);
   eligible=false;
   await page.reload();
   await page.getByText('No checkout required').waitFor();
   assert.equal(await page.getByRole('dialog').count(),0);
   console.log(`PASS ${width}px: request form, keyboard submission, no GET side effects, open-tool state`);
   await page.close();
  }
 } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
