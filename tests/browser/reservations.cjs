// Real portal bundle, mocked API, disposable browser; no external writes.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '../..');
const output = path.join(root,'tmp/reservation-browser');
const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/makerspace-react.css"><script defer src="/assets/makerspace-react.js"></script></head><body></body></html>';
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const file=url.pathname==='/assets/FilledLaserableLogo.svg' ? path.join(root,'src/assets/FilledLaserableLogo.svg') : url.pathname.startsWith('/assets/') ? path.join(root,'dist',path.basename(url.pathname)) : null;
  res.setHeader('Content-Type',file?.endsWith('.svg')?'image/svg+xml':file?.endsWith('.js')?'text/javascript':file?.endsWith('.css')?'text/css':'text/html');
  res.end(file && fs.existsSync(file) ? fs.readFileSync(file) : html);
});
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});
  try {
    for(const width of [320,600,900,1280]) {
      const page=await browser.newPage({viewport:{width,height:900}});
      const now=Date.now();
      const member={id:'member1',firstname:'Test',lastname:'Member',email:'test@example.com',role:'admin',status:'activeMember',expirationTime:now+86400000,memberContractOnFile:true,subscription:true};
      const common={memberId:'member1',memberName:'Test Member',title:'Cabinet project',shopId:'shop1',shopName:'Wood',reservationScope:'tools',toolIds:['tool1'],toolNames:['Saw'],startAt:new Date(now-1200000).toISOString(),endAt:new Date(now+3600000).toISOString(),approvalReasons:[],approvalDetails:[],source:'portal',createdAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString()};
      const rows=[{...common,id:'no-show',status:'abandoned',abandonedAt:new Date(now).toISOString()},
        {...common,id:'early-release',title:'Finished early',status:'cancelled',decisionNote:'released_on_logoff'}];
      await page.route('**/api/**',async route=>{
        const url=new URL(route.request().url()); let body={};
        if(url.pathname==='/api/config') body={wiki_url:''};
        else if(url.pathname==='/api/members/sign_in') body=member;
        else if(url.pathname.endsWith('/permissions')) body={billing:true};
        else if(url.pathname==='/api/reservation_catalog') body={shops:[],tools:[],toolGroups:[]};
        else if(url.pathname==='/api/reservations' || url.pathname==='/api/admin/reservations') body=rows.filter(r=>!url.searchParams.get('status') || r.status===url.searchParams.get('status'));
        else if(/reservations|shops|tools|invoice_options|discounts/.test(url.pathname)) body=[];
        await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/reservations`);
      const tab=page.getByRole('tab',{name:'My Reservations',exact:true});
      await tab.waitFor(); await tab.focus(); await page.keyboard.press('Enter');
      await page.getByText('Released after no check-in within 15 minutes.',{exact:false}).waitFor();
      await page.getByText('Remaining reservation released when the owner logged off the tool.').waitFor();
      assert.equal(await page.getByRole('button',{name:'Edit',exact:true}).count(),0);
      assert.equal(await page.getByRole('button',{name:'Cancel',exact:true}).count(),0);
      await page.getByRole('tab',{name:'History',exact:true}).click();
      await page.getByText('Released after no check-in within 15 minutes.',{exact:false}).waitFor();
      await page.waitForTimeout(350); // Allow the tab indicator's CSS transition to finish before visual capture.
      await page.screenshot({path:path.join(output,`history-${width}.png`),fullPage:true});
      const overflow=await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).filter(e=>e.getBoundingClientRect().right>window.innerWidth+1).slice(0,8).map(e=>({tag:e.tagName,class:e.className,width:e.getBoundingClientRect().width,text:e.textContent.slice(0,60)})));
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`overflow at ${width}: ${JSON.stringify(overflow)}`);
      await page.getByRole('tab',{name:'In My Shops',exact:true}).click();
      await page.getByText('Released after no check-in within 15 minutes.',{exact:false}).waitFor();
      await page.waitForTimeout(350);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`managed overflow at ${width}`);
      await page.screenshot({path:path.join(output,`managed-${width}.png`),fullPage:true});
      await page.close();
    }
    console.log('Reservation history, terminal actions, keyboard tabs and 320/600/900/1280 layouts passed');
  } finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
