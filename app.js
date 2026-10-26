(function (root) {
'use strict';
const units = ['g', 'ml', '個', '枚', 'ロール', 'm'];
const clean = n => { if (!Number.isFinite(n)) throw Error('計算できません'); return Number(n.toPrecision(12)); };
function tokenize(expression) {
 const s = expression.replace(/\s/g, '').replace(/[×]/g, '*').replace(/[÷]/g, '/').replace(/[−–]/g, '-');
 const tokens = []; let i = 0;
 while (i < s.length) { const m = s.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)/); if (m) { tokens.push(Number(m[0])); i += m[0].length; } else if ('+-*/()%'.includes(s[i])) tokens.push(s[i++]); else throw Error('使えない文字があります'); }
 return tokens;
}
function calculate(expression) {
 const t = tokenize(expression); let i = 0;
 function atom() { let v; if (t[i] === '+' || t[i] === '-') { const sign = t[i++]; v = atom(); return {n: sign === '-' ? -v.n : v.n, percent:v.percent}; } if (t[i] === '(') { i++; v = sum(); if (t[i++] !== ')') throw Error('括弧を確認してください'); } else { if (typeof t[i] !== 'number') throw Error('式を完成させてください'); v = {n:t[i++], percent:false}; } while (t[i] === '%') { i++; v = {n:clean(v.n / 100), percent:true}; } return v; }
 function product() { let a = atom(); while (t[i] === '*' || t[i] === '/') { const op=t[i++], b=atom(); if (op === '/' && b.n === 0) throw Error('0では割れません'); a={n:clean(op === '*' ? a.n*b.n : a.n/b.n), percent:false}; } return a; }
 function sum() { let a=product(); while (t[i] === '+' || t[i] === '-') { const op=t[i++], b=product(), n=b.percent ? a.n*b.n : b.n; a={n:clean(op === '+' ? a.n+n : a.n-n), percent:false}; } return a; }
 const result=sum(); if (i !== t.length) throw Error('式を確認してください'); return clean(result.n);
}
function quick(expression, factor) { calculate(expression); return (/[+\-−]/.test(expression) ? '('+expression+')' : expression) + ' × ' + factor; }
function roundPrice(n) { return clean(Math.round((clean(n)+Number.EPSILON)*100)/100); }
function unitPrice(price, quantity, unit) { return price>0 && quantity>0 ? clean(price/quantity * (unit==='g'||unit==='ml'?100:1)) : null; }
function compare(cards, unit) { const values=cards.map(c=>unitPrice(c.price,c.quantity,unit)), valid=values.filter(v=>v!==null); const min=valid.length>=2?Math.min(...valid):null; return values.map(value=>({value, cheapest:value!==null && min!==null && value===min, difference:value!==null&&min!==null?clean(value-min):null, percent:value!==null&&min!==null?clean((value-min)/min*100):null})); }
const emptyCards=()=>Array.from({length:4},()=>({price:null, quantity:null, priceExpr:'', quantityExpr:''}));
const api={tokenize,calculate,quick,roundPrice,unitPrice,compare,emptyCards};
root.PriceCompare=api; if(typeof module!=='undefined') module.exports=api;
if(typeof document==='undefined' || !document.querySelector('[data-view="compare"]')) return;
const $=s=>document.querySelector(s), fmt=n=>new Intl.NumberFormat('ja-JP',{maximumFractionDigits:2}).format(n);
let state={unit:'g',cards:emptyCards(),editing:null}, undo=null, timer;
try { const saved=JSON.parse(localStorage.getItem('otoku-v1')); if(saved&&units.includes(saved.unit)&&saved.cards?.length===4) state=saved; } catch(e) {}
function save(){try{localStorage.setItem('otoku-v1',JSON.stringify(state));}catch(e){$('#storage-note').textContent='保存できません。この画面を閉じると入力が失われます。';}}
function render(){
 const results=compare(state.cards,state.unit);
 $('#units').innerHTML=units.map(u=>`<button type="button" data-unit="${u}" aria-pressed="${u===state.unit}">${u}</button>`).join('');
 $('#cards').innerHTML=state.cards.map((c,i)=>{const r=results[i],base=(state.unit==='g'||state.unit==='ml'?'100':'1')+state.unit; return `<article class="card ${r.cheapest?'best':''}" id="card-${i}"><div class="card-head"><strong>商品 ${'ABCD'[i]}</strong><span class="badge">${r.cheapest?'最安':''}</span><button class="clear-card" data-clear="${i}" aria-label="商品${'ABCD'[i]}をクリア">×</button></div>${['price','quantity'].map(f=>`<label><span>${f==='price'?'価格(円)':'数量'}</span><input readonly inputmode="none" data-card="${i}" data-field="${f}" aria-label="商品${'ABCD'[i]}の${f==='price'?'価格':'数量'}" value="${c[f]===null?'':fmt(c[f])}" class="${state.editing?.index===i&&state.editing?.field===f?'selected':''}"></label><div class="formula">${(/[+−–×÷%()*/-]/.test(c[f+'Expr']||'')?escapeText(c[f+'Expr']):'')||'&nbsp;'}</div>`).join('')}<div class="result">${r.value===null?'—':base+'あたり <strong>'+new Intl.NumberFormat('ja-JP',{minimumFractionDigits:2,maximumFractionDigits:2}).format(r.value)+'円</strong>'}</div><div class="difference">${r.difference>0?'最安比 +'+r.difference.toFixed(2)+'円<br>(+'+r.percent.toFixed(1)+'%)':'&nbsp;'}</div></article>`;}).join('');
 $('#keypad').hidden=!state.editing; document.body.classList.toggle('editing',!!state.editing);
 if(state.editing){$('#expression').textContent=state.editing.expr||'式を入力'; $('#editing-label').textContent='商品'+ 'ABCD'[state.editing.index]+'・'+(state.editing.field==='price'?'価格（円）':'数量（'+state.unit+'）'); preview();}
}
function escapeText(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function preview(){try{$('#preview').textContent='= '+fmt(calculate(state.editing.expr));$('#preview').classList.remove('error');}catch(e){$('#preview').textContent=state.editing.expr?e.message:'数字を入力してください';$('#preview').classList.add('error');}}
function open(index,field){if(state.editing&&!commit(false))return; state.editing={index,field,expr:state.cards[index][field+'Expr']||String(state.cards[index][field]??'')};save();render(); requestAnimationFrame(()=>$('#card-'+index).scrollIntoView({block:'nearest',behavior:'smooth'}));}
function commit(close){const e=state.editing;if(!e)return true;try{const n=e.expr.trim()?calculate(e.expr):null;state.cards[e.index][e.field]=n===null?null:e.field==='price'?roundPrice(n):n;state.cards[e.index][e.field+'Expr']=e.expr;if(close)state.editing=null;save();render();return true;}catch(err){$('#preview').textContent=err.message+'（値は変更していません）';$('#preview').classList.add('error');return false;}}
function clear(index){undo=JSON.parse(JSON.stringify(state));state.editing=null;if(index===undefined)state.cards=emptyCards();else state.cards[index]=emptyCards()[0];save();render();$('#toast').hidden=false;clearTimeout(timer);timer=setTimeout(()=>{$('#toast').hidden=true;undo=null;},5000);}
$('#units').addEventListener('click',e=>{if(e.target.dataset.unit){state.unit=e.target.dataset.unit;save();render();}});
$('#cards').addEventListener('click',e=>{if(e.target.dataset.clear!==undefined)clear(Number(e.target.dataset.clear));else if(e.target.dataset.field)open(Number(e.target.dataset.card),e.target.dataset.field);});
$('#clear-all').onclick=()=>clear();
$('#undo').onclick=()=>{if(undo){state=undo;undo=null;clearTimeout(timer);$('#toast').hidden=true;save();render();}};
$('#keypad').addEventListener('click',event=>{const b=event.target.closest('button');if(!b||!state.editing)return;const e=state.editing,k=b.dataset.key,a=b.dataset.action;
 if(k!==undefined)e.expr+=k;
 else if(b.dataset.factor){try{e.expr=quick(e.expr,Number(b.dataset.factor));}catch(err){$('#preview').textContent=err.message;return;}}
 else if(a==='back')e.expr=e.expr.slice(0,-1);else if(a==='clear')e.expr='';else if(a==='equal'){try{e.expr=String(calculate(e.expr));}catch(err){$('#preview').textContent=err.message;return;}}
 else if(a==='close'||a==='confirm'){commit(true);return;}else if(a==='next'){if(commit(false)){const n=(e.index*2+(e.field==='quantity'?1:0)+1)%8;state.editing=null;open(Math.floor(n/2),n%2?'quantity':'price');}return;}
 save();render(); });
document.addEventListener('click',e=>{if(state.editing&&!e.target.closest('#keypad, input, #clear-all, .clear-card, #undo, #units'))commit(true);});
document.addEventListener('keydown',e=>{if(e.key==='Escape')commit(true);});
render(); if(state.editing)requestAnimationFrame(()=>$('#card-'+state.editing.index).scrollIntoView({block:'nearest'}));
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{$('#storage-note').textContent='オフライン準備ができません。接続と公開先を確認してください。';});
})(typeof globalThis!=='undefined'?globalThis:this);
