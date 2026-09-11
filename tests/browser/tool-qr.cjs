// Run after npm run build: node tests/browser/tool-qr.cjs
// Optional, warning-only slow-request check: set RUN_SLOW_REQUEST_TEST=1.
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
const QRCode = require('qrcode');
const tool2 = '1123456789abcdef01234567';
const target = toolId => `HTTPS://PUBLIC.EXAMPLE.TEST/L${toolId === id ? "23456789AB" : "23456789AC"}`;
(async()=>{
 await new Promise(resolve=>server.listen(8767,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),headless:true});
 try {
  for(const width of [320,600,900,1440]) {
   const page=await browser.newPage({viewport:{width,height:900}});
   await page.addInitScript(()=>{
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{if(window.failTextClipboard) throw new Error('Clipboard unavailable');window.copiedText=value;},write:async items=>{
     if(window.failClipboard) throw new Error('Unsupported');
     const blob=await items[0].getType('image/png');
     window.copiedPng={type:blob.type,size:blob.size};
    }}});
   });
   let failShortcodes=false;
   let shortGate=null;
   let shortRequests=0;
   await page.route('**/api/**',async route=>{
    const pathname=new URL(route.request().url()).pathname;
    let body=[];
    if(pathname==='/api/config') body={wiki_url:'https://wiki.example.test',app_domain:'public.example.test'};
    else if(pathname==='/api/members/sign_in') body={id:'member1',email:'admin@example.com',firstname:'Test',lastname:'Admin',role:'admin',status:'activeMember'};
    else if(pathname==='/api/shortcodes') {
      shortRequests++;
      if(shortGate) await shortGate;
      if(failShortcodes) return route.fulfill({status:503,contentType:'application/json',body:'{}'});
      const requested = route.request().postDataJSON().target_url;
      assert([`/api/tool/${id}/public.html`, `/api/tool/${tool2}/public.html`, '/api/shop/shop1/public.html', '/rentals/spots/2123456789abcdef01234567', '/rentals/spots/3123456789abcdef01234567'].includes(requested));
      body={code:'23456789AB',short_url:requested.startsWith('/rentals/') ? (requested.includes('3123456789abcdef01234567') ? 'HTTPS://PUBLIC.EXAMPLE.TEST/L23456789AE' : 'HTTPS://PUBLIC.EXAMPLE.TEST/L23456789AD') : target(requested.includes(tool2) ? tool2 : id)};
    }
    else if(pathname==='/api/workshops') body={canAddShop:true,workshops:[{id:'shop1',name:'Woodworking',resourceManagers:[],upcomingVolunteerEvents:[],volunteerTasks:[],tools:[]}]};
    else if(pathname.includes('/permissions')) body={};
    else if(pathname==='/api/shops' || pathname==='/api/admin/shops') body=[{id:'shop1',name:'Woodworking'}];
    else if(pathname==='/api/admin/tools') body=[{id,name:'Table Saw',shopId:'shop1',shopName:'Woodworking',prerequisiteNames:[],prerequisiteIds:[],notes:''},{id:tool2,name:'Band Saw',shopId:'shop1',shopName:'Woodworking',prerequisiteNames:[],prerequisiteIds:[],notes:''}];
    else if(pathname==='/api/admin/rental_spots') body=[{id:'2123456789abcdef01234567',number:'A-01',location:'Shelf',active:true},{id:'3123456789abcdef01234567',number:'A-02',location:'Shelf',active:true}];
    await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
   });
   await page.goto('http://127.0.0.1:8767/tool-checkouts');
   await page.getByRole('tab',{name:'Tools',exact:true}).click();
   assert.equal(await page.getByRole('button',{name:'QR Code',exact:true}).count(),0);
   await page.locator(`#tools-table-${id}-select`).check();
   await page.getByRole('button',{name:'QR Code',exact:true}).click();
   const dialog=page.getByRole('dialog',{name:'QR Code — Table Saw'});
   await dialog.getByRole('link',{name:target(id),exact:true}).waitFor();
   const encoded=QRCode.create(target(id));
   assert.equal(encoded.segments[0].mode.id,'Alphanumeric');
   const expected=encoded.modules;
   const matches=await dialog.locator('canvas').evaluate((canvas,{size,data})=>{
    const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    const scale=canvas.width/(size+4);
    return data.every((bit,index)=>{
      const x=Math.floor((index%size+2.5)*scale), y=Math.floor((Math.floor(index/size)+2.5)*scale);
      return (pixels[(y*canvas.width+x)*4]<128)===!!bit;
    });
   },{size:expected.size,data:Array.from(expected.data)});
   assert(matches,'QR pixels must encode the APP_DOMAIN URL');
   const downloadPromise=page.waitForEvent('download');
   await dialog.getByRole('link',{name:'download it as a PNG'}).click();
   const download=await downloadPromise;
   assert.equal(download.suggestedFilename(),`tool-${id}-qr.png`);
   const png=fs.readFileSync(await download.path());
   assert.equal(png.subarray(1,4).toString(),'PNG');
   await dialog.getByRole('button',{name:'Copy Image'}).click();
   await dialog.getByRole('button',{name:'Copied!'}).waitFor();
   assert((await page.evaluate(()=>window.copiedPng)).size>0);
   const bounds=await dialog.boundingBox();
   assert(bounds.x>=0 && bounds.x+bounds.width<=width);
   await page.waitForTimeout(250); // Let the MUI transition settle for visual checks.
   await page.screenshot({path:path.join(root,`tmp/tool-qr-${width}.png`),fullPage:true});
   await dialog.getByRole('button',{name:'Close',exact:true}).click();
   await page.locator(`#tools-table-${tool2}-select`).check();
   await page.getByRole('button',{name:'QR Code',exact:true}).click();
   await page.getByRole('link',{name:target(tool2),exact:true}).waitFor();
   await page.evaluate(()=>{window.failClipboard=true;});
   await page.getByRole('button',{name:'Copy Image'}).click();
   await page.getByRole('alert').filter({hasText:'Download PNG'}).waitFor();
   await page.keyboard.press('Escape');
   await page.getByRole('dialog').waitFor({state:'hidden'});
   failShortcodes=true;
   await page.getByRole('button',{name:'QR Code',exact:true}).click();
   const toolFallback=`https://public.example.test/api/tool/${tool2}/public.html`;
   await page.getByRole('dialog').getByRole('link',{name:toolFallback,exact:true}).waitFor();
   await page.getByRole('alert').filter({hasText:'This QR code uses the full link'}).waitFor();
   await page.getByRole('dialog').getByRole('link',{name:'download it as a PNG'}).waitFor();
   assert.equal(await page.getByRole('dialog').locator('canvas').count(),1);
   await page.keyboard.press('Escape');
   await page.getByRole('dialog').waitFor({state:'hidden'});
   failShortcodes=false;
   await page.getByRole('tab',{name:'Shops',exact:true}).click();
   await page.locator('#shops-table-shop1-select').check();
   await page.getByRole('button',{name:'QR Code',exact:true}).focus();
   await page.keyboard.press('Enter');
   await page.getByRole('dialog',{name:'QR Code — Woodworking'}).getByRole('link',{name:target(id),exact:true}).waitFor();
   await page.waitForTimeout(250); // Let the MUI transition settle for visual checks.
   await page.screenshot({path:path.join(root,`tmp/shop-qr-${width}.png`),fullPage:true});
   await page.keyboard.press('Escape');
   await page.goto('http://127.0.0.1:8767/workshops');
   await page.getByRole('tab',{name:'Details',exact:true}).click();
   await page.getByRole('button',{name:'QR Code',exact:true}).click();
   await page.getByRole('dialog',{name:'QR Code — Woodworking'}).getByRole('link',{name:target(id),exact:true}).waitFor();
   const shopBounds=await page.getByRole('dialog').boundingBox();
   assert(shopBounds.x>=0 && shopBounds.x+shopBounds.width<=width);
   await page.waitForTimeout(250); // Let the MUI transition settle for visual checks.
   await page.screenshot({path:path.join(root,`tmp/workshop-qr-${width}.png`),fullPage:true});
   await page.keyboard.press('Escape');
   // Rental labels share the same shortcode and fallback behavior.
   await page.goto('http://127.0.0.1:8767/admin/rentals');
   await page.getByRole('tab',{name:'Rental Spots',exact:true}).click();
   await page.locator('#admin-rental-spots-table-2123456789abcdef01234567-select').check();
   await page.getByRole('button',{name:'QR Code',exact:true}).click();
   await page.getByRole('dialog',{name:'QR Code — A-01'}).getByRole('link',{name:'HTTPS://PUBLIC.EXAMPLE.TEST/L23456789AD',exact:true}).waitFor();
   await page.getByRole('button',{name:'Close',exact:true}).click();
   await page.getByRole('button',{name:'Copy Link',exact:true}).click();
   await page.waitForFunction(()=>window.copiedText==='HTTPS://PUBLIC.EXAMPLE.TEST/L23456789AD');
   failShortcodes=true;
   await page.getByRole('button',{name:'QR Code',exact:true}).click();
   await page.getByRole('alert').filter({hasText:'This QR code uses the full link'}).waitFor();
   await page.getByRole('dialog').getByRole('link',{name:'http://127.0.0.1:8767/rentals/spots/2123456789abcdef01234567',exact:true}).waitFor();
   await page.getByRole('dialog').getByRole('link',{name:'download it as a PNG'}).waitFor();
   assert.equal(await page.getByRole('dialog').locator('canvas').count(),1);
   await page.getByRole('button',{name:'Close',exact:true}).click();
   await page.locator('#admin-rental-spots-table-3123456789abcdef01234567-select').check();
   failShortcodes=true;
   await page.getByRole('button',{name:'Copy Link',exact:true}).click();
   const longUrl='http://127.0.0.1:8767/rentals/spots/3123456789abcdef01234567';
   await page.waitForFunction(url=>window.copiedText===url,longUrl);
   await page.getByRole('alert').getByRole('link',{name:longUrl,exact:true}).waitFor();
   assert(await page.getByRole('alert').evaluate(alert=>!!(alert.compareDocumentPosition(document.querySelector('table')) & Node.DOCUMENT_POSITION_FOLLOWING)), 'Copy recovery must be above the rental table');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"Rental fallback page must fit viewport");
   await page.waitForTimeout(250); // Let the MUI transition settle for visual checks.
   await page.screenshot({path:path.join(root,`tmp/rental-link-fallback-${width}.png`),fullPage:true});
   await page.evaluate(()=>{window.failTextClipboard=true;});
   await page.getByRole('button',{name:'Copy Link',exact:true}).click();
   await page.getByRole('alert').filter({hasText:'Could not copy automatically'}).waitFor();
   assert.equal(await page.getByRole('alert').getByRole('link').getAttribute('href'),longUrl);
   console.log(`PASS ${width}px: selected tool, QR pixels/target, PNG, clipboard, close, tool switch, rental regression`);
   if (process.env.RUN_SLOW_REQUEST_TEST === '1') {
     let releaseShortcode;
     page.setDefaultTimeout(5000);
     try {
       failShortcodes=false;
       await page.evaluate(()=>{window.copiedText='';window.failTextClipboard=false;});
       await page.locator('#admin-rental-spots-table-2123456789abcdef01234567-select').check();
       shortGate=new Promise(resolve=>{releaseShortcode=resolve;});
       const requestsBefore=shortRequests;
       await Promise.all([
         page.waitForRequest(request=>request.url().endsWith('/api/shortcodes')),
         page.getByRole('button',{name:'Copy Link',exact:true}).click(),
       ]);
       const pending=page.getByRole('button',{name:'Copying…',exact:true});
       assert(await pending.isDisabled());
       await pending.evaluate(button=>{button.click();button.click();});
       assert.equal(shortRequests,requestsBefore+1);
       await page.locator('#admin-rental-spots-table-3123456789abcdef01234567-select').check();
       releaseShortcode(); shortGate=null;
       await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(button=>button.textContent==='Copy Link' && !button.disabled));
       assert.equal(await page.evaluate(()=>window.copiedText),'','Changed selection must not copy a stale result');
       console.log(`PASS optional slow-request check at ${width}px`);
     } catch (error) {
       console.warn(`WARN optional slow-request check at ${width}px: ${error.message}`);
     } finally {
       releaseShortcode?.();
       shortGate=null;
       await page.unrouteAll({behavior:'wait'}).catch(error=>console.warn(`WARN optional slow-request cleanup: ${error.message}`));
     }
   } else {
     console.log(`SKIP optional slow-request check at ${width}px (RUN_SLOW_REQUEST_TEST=1 to enable)`);
   }
   await page.close();
  }
  for (const role of ['board_member', 'resource_manager', 'member']) {
   const page=await browser.newPage({viewport:{width:600,height:900}});
   await page.route('**/api/**', async route=>{
    const pathname=new URL(route.request().url()).pathname;
    let body=[];
    if(pathname==='/api/config') body={app_domain:'public.example.test'};
    else if(pathname==='/api/members/sign_in') body={id:'member1',email:'test@example.com',firstname:'Test',lastname:'User',role,status:'activeMember',isCheckoutApprover:role==='member',resourceManagerShopIds:[]};
    else if(pathname==='/api/shops') body=[{id:'shop1',name:'Woodworking'}];
    else if(pathname==='/api/admin/shops') body=role==='board_member'?[{id:'shop1',name:'Woodworking'}]:[];
    else if(pathname==='/api/admin/tools') body=[{id,name:'Table Saw',shopId:'shop1',shopName:'Woodworking',prerequisiteNames:[],prerequisiteIds:[],notes:''}];
    else if(pathname==='/api/workshops') body={canAddShop:role==='board_member',workshops:[{id:'shop1',name:'Woodworking',resourceManagers:[],upcomingVolunteerEvents:[],volunteerTasks:[],tools:[]}]};
    else if(pathname==='/api/shortcodes') body={code:'23456789AB',short_url:target(id)};
    else if(pathname.includes('/permissions')) body={};
    await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
   });
   await page.goto('http://127.0.0.1:8767/tool-checkouts');
   if(role==='member') {
    await page.getByRole('tab',{name:'Tools',exact:true}).click();
    assert.equal(await page.getByRole('tab',{name:'Shops',exact:true}).count(),0);
    await page.locator(`#tools-table-${id}-select`).check();
   } else {
    await page.getByRole('tab',{name:'Shops',exact:true}).click();
    await page.locator('#shops-table-shop1-select').check();
    if(role==='resource_manager') assert.equal(await page.getByRole('button',{name:'Edit',exact:true}).count(),0);
   }
   await page.getByRole('button',{name:'QR Code',exact:true}).click();
   await page.getByRole('dialog').getByRole('link',{name:target(id),exact:true}).waitFor();
   await page.keyboard.press('Escape');
   await page.goto('http://127.0.0.1:8767/workshops');
   await page.getByRole('tab',{name:'Details',exact:true}).click();
   if(role==='member') assert.equal(await page.getByRole('button',{name:'QR Code',exact:true}).count(),0);
   else {
    await page.getByRole('button',{name:'QR Code',exact:true}).click();
    await page.getByRole('dialog').getByRole('link',{name:target(id),exact:true}).waitFor();
   }
   console.log(`PASS QR permissions: ${role}`);
   await page.close();
  }
 } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
