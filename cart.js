/* ONLY BAD OPTIONS — shared multi-item cart (works across index + product pages) */
(function(){
'use strict';

/* minimal catalog used to render the cart (name / price / image).
   Full product data lives in product.html. Keep prices in sync here. */
const CAT = {
  "shirt-easy":  {name:'T-Shirt „easy easy“',      price:26, img:'images/shirt-easy.jpg'},
  "shirt-dino":  {name:'T-Shirt „Dino“',           price:26, img:'images/shirt-dino.jpg'},
  "vinyl-lp":    {name:'Vinyl „easy easy“ (LP)',    price:36, img:'images/vinyl-lp.jpg'},
  "vinyl-ep":    {name:'Echoes Vol. 1 & 2 (EP)',    price:31, img:'images/vinyl-ep.jpg'},
  "cd":          {name:'CD „easy easy“ Deluxe',     price:11, img:'images/cd.jpg'},
  "schal":       {name:'Schal „EASY“',              price:19, img:'images/schal.jpg'},
  "cap":         {name:'Vintage Cap „easy easy“',   price:26, img:'images/cap.jpg'},
  "poster-asl":  {name:'Poster „Alles so leid“ 2025',price:6, img:'images/poster-asl.jpg'},
  "poster-luxor":{name:'Poster „Luxor 2022“',       price:6, img:'images/poster-luxor.jpg'},
  "test-luis":   {name:'luis ist ein pupskopf',      price:0.01, img:'images/logo.png', noShip:true},
};

/* ── SumUp checkout endpoint ────────────────────────────────────────
   Set this to your deployed serverless function (see backend/README.md).
   While empty, "zur kasse" shows a friendly "coming soon" note.        */
const CHECKOUT_URL = "https://only-bad-options.vercel.app/api/checkout";

// Flat DHL shipping fees (display only — the backend re-computes these when
// charging). Adjust to your real DHL rates. de = Germany, eu = rest of EU.
const SHIP = { de: 4.90, eu: 9.90 };

const KEY='obo_cart';
const euro=n=> n.toFixed(2).replace('.',',')+' €';
const get=()=>{ try{return JSON.parse(localStorage.getItem(KEY))||[]}catch(e){return[]} };
const save=c=>{ localStorage.setItem(KEY,JSON.stringify(c)); update(); };
const count=()=> get().reduce((s,i)=>s+i.qty,0);
const total=()=> get().reduce((s,i)=>s+((CAT[i.id]?CAT[i.id].price:0)*i.qty),0);

function add(id,size){ size=size||''; if(!CAT[id])return; const c=get(); const it=c.find(x=>x.id===id&&x.size===size); if(it)it.qty++; else c.push({id:id,size:size,qty:1}); save(c); open(); }
function setQty(id,size,q){ const c=get(); const it=c.find(x=>x.id===id&&x.size===size); if(!it)return; if(q<1){ save(c.filter(x=>!(x.id===id&&x.size===size))); } else { it.qty=q; save(c); } }
function remove(id,size){ save(get().filter(x=>!(x.id===id&&x.size===size))); }

function build(){
  if(document.getElementById('obo-cart'))return;
  const st=document.createElement('style');
  st.textContent=`
  #obo-cart .oc-ov{position:fixed;inset:0;background:rgba(0,0,0,.4);opacity:0;visibility:hidden;transition:opacity .25s;z-index:998}
  #obo-cart.on .oc-ov{opacity:1;visibility:visible}
  #obo-cart .oc-panel{position:fixed;top:0;right:0;height:100%;width:390px;max-width:90vw;background:var(--bg,#fff);
    border-left:1px solid var(--ink,#0d0d0d);transform:translateX(100%);transition:transform .28s cubic-bezier(.4,0,.2,1);
    z-index:999;display:flex;flex-direction:column;font-family:var(--sans,sans-serif)}
  #obo-cart.on .oc-panel{transform:translateX(0)}
  #obo-cart .oc-head{display:flex;align-items:center;justify-content:space-between;padding:20px 22px;border-bottom:1px solid var(--ink,#0d0d0d)}
  #obo-cart .oc-head span{font-family:var(--display);text-transform:uppercase;font-size:19px;letter-spacing:-.01em}
  #obo-cart .oc-close{background:none;border:0;font-size:20px;cursor:pointer;line-height:1;color:var(--ink,#0d0d0d)}
  #obo-cart .oc-items{flex:1;overflow-y:auto;padding:6px 22px}
  #obo-cart .oc-empty{font-family:var(--mono);font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted,#888);padding:40px 0;text-align:center}
  #obo-cart .oc-item{display:grid;grid-template-columns:64px 1fr auto;gap:14px;padding:18px 0;border-bottom:1px solid var(--line,rgba(0,0,0,.13))}
  #obo-cart .oc-th{width:64px;height:64px;border:1px solid var(--ink,#0d0d0d);display:grid;place-items:center;padding:6px;background:#fff}
  #obo-cart .oc-th img{max-width:100%;max-height:100%;object-fit:contain}
  #obo-cart .oc-name{font-family:var(--display);text-transform:uppercase;font-size:13px;line-height:1.05;margin-bottom:4px}
  #obo-cart .oc-size{font-family:var(--mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#888);margin-bottom:8px}
  #obo-cart .oc-qty{display:flex;align-items:center;gap:0;font-family:var(--mono);font-size:12px}
  #obo-cart .oc-qty button{width:26px;height:26px;border:1px solid var(--ink,#0d0d0d);background:#fff;cursor:pointer;font-size:14px;line-height:1;display:grid;place-items:center}
  #obo-cart .oc-qty span{min-width:34px;text-align:center}
  #obo-cart .oc-rm{border:0!important;background:none!important;width:auto!important;margin-left:12px;color:var(--muted,#888);font-family:var(--mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;text-decoration:underline;cursor:pointer}
  #obo-cart .oc-price{font-family:var(--mono);font-size:13px;white-space:nowrap}
  #obo-cart .oc-foot{border-top:1px solid var(--ink,#0d0d0d);padding:20px 22px 24px}
  #obo-cart .oc-note{display:none;font-family:var(--mono);font-size:11px;letter-spacing:.03em;color:#fff;background:var(--accent,#ff2e88);padding:10px 12px;margin-bottom:14px;text-align:center}
  #obo-cart .oc-sumrow{display:flex;justify-content:space-between;align-items:baseline;font-family:var(--mono);font-size:14px;margin-bottom:4px}
  #obo-cart .oc-sub{font-size:16px}
  #obo-cart .oc-ship{font-family:var(--mono);font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted,#888);margin-bottom:16px}
  #obo-cart .oc-checkout{width:100%;background:var(--ink,#0d0d0d);color:#fff;border:0;padding:16px;font-family:var(--mono);font-size:12px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:background .15s;margin-bottom:8px}
  #obo-cart .oc-checkout:hover:not(:disabled){background:var(--accent,#ff2e88)}
  #obo-cart .oc-checkout:disabled{background:var(--panel,#eee);color:var(--muted,#999);cursor:not-allowed}
  #obo-cart .oc-cont{width:100%;background:none;border:0;padding:6px;font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#888);cursor:pointer}
  #obo-cart .oc-cont:hover{color:var(--ink,#000)}`;
  document.head.appendChild(st);
  const el=document.createElement('div'); el.id='obo-cart';
  el.innerHTML=`<div class="oc-ov"></div><aside class="oc-panel" role="dialog" aria-label="Warenkorb">
    <div class="oc-head"><span>Warenkorb</span><button class="oc-close" aria-label="schließen">✕</button></div>
    <div class="oc-items"></div>
    <div class="oc-foot">
      <div class="oc-note"></div>
      <div class="oc-sumrow"><span>Zwischensumme</span><span class="oc-sub">0,00 €</span></div>
      <div class="oc-ship">inkl. MwSt · zzgl. Versand</div>
      <button class="oc-checkout">zur kasse · SumUp</button>
      <button class="oc-cont">weiter shoppen</button>
    </div></aside>`;
  document.body.appendChild(el);
  el.querySelector('.oc-ov').addEventListener('click',close);
  el.querySelector('.oc-close').addEventListener('click',close);
  el.querySelector('.oc-cont').addEventListener('click',close);
  el.querySelector('.oc-checkout').addEventListener('click',checkout);
}

function render(){
  const wrap=document.querySelector('#obo-cart .oc-items'); if(!wrap)return;
  const c=get();
  if(!c.length){ wrap.innerHTML='<div class="oc-empty">Dein Warenkorb ist leer.</div>'; }
  else wrap.innerHTML=c.map(i=>{ const p=CAT[i.id]||{name:i.id,price:0,img:''};
    return `<div class="oc-item"><div class="oc-th"><img src="${p.img}" alt=""></div>
      <div><div class="oc-name">${p.name}</div>${i.size?`<div class="oc-size">${i.size}</div>`:'<div class="oc-size">&nbsp;</div>'}
      <div class="oc-qty"><button data-a="dec" data-id="${i.id}" data-s="${i.size}">–</button><span>${i.qty}</span><button data-a="inc" data-id="${i.id}" data-s="${i.size}">+</button><button class="oc-rm" data-a="rm" data-id="${i.id}" data-s="${i.size}">entfernen</button></div></div>
      <div class="oc-price">${euro(p.price*i.qty)}</div></div>`; }).join('');
  document.querySelector('#obo-cart .oc-sub').innerHTML=euro(total());
  document.querySelector('#obo-cart .oc-checkout').disabled=!c.length;
  wrap.querySelectorAll('button[data-a]').forEach(b=>b.addEventListener('click',()=>{
    const id=b.getAttribute('data-id'), s=b.getAttribute('data-s'), a=b.getAttribute('data-a');
    const it=get().find(x=>x.id===id&&x.size===s); const q=it?it.qty:1;
    if(a==='inc')setQty(id,s,q+1); else if(a==='dec')setQty(id,s,q-1); else if(a==='rm')remove(id,s);
    render();
  }));
}

function open(){ build(); render(); const c=document.getElementById('obo-cart'); c.classList.add('on'); document.body.style.overflow='hidden'; }
function close(){ const c=document.getElementById('obo-cart'); if(c)c.classList.remove('on'); document.body.style.overflow=''; }
function update(){ document.querySelectorAll('.cartcount').forEach(e=>e.textContent=count()); if(document.querySelector('#obo-cart.on'))render(); }
function note(m){ const n=document.querySelector('#obo-cart .oc-note'); if(n){n.textContent=m; n.style.display='block';} }

function checkout(){
  if(!get().length) return;
  location.href = 'checkout.html';   // collect shipping + contact, then → SumUp
}

window.OBOCart={add:add,open:open,close:close,count:count,total:total,get:get,cat:CAT,checkoutUrl:CHECKOUT_URL,ship:SHIP};

document.addEventListener('DOMContentLoaded',function(){
  build(); update();
  document.querySelectorAll('.cartwrap').forEach(w=>{ w.style.cursor='pointer'; w.addEventListener('click',function(e){ e.preventDefault(); open(); }); });
});
})();
