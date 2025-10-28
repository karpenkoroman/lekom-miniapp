// === SETTINGS ===
// HOOK используется ТОЛЬКО для аудита/лидов; опрос по темам — локально (без сети)
const HOOK = 'https://script.google.com/macros/s/AKfycbyvq_c0Hx2jKQ5PyMpqMuCRiCY_PAaMaocgrCAf1X20fVbIrJlj_mQ3cp-TG0TRNUbw/exec';

// === Telegram initData (для аудита/лидов)
let tgInit = {};
try {
  if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.ready();
    tgInit = window.Telegram.WebApp.initDataUnsafe || {};
  }
} catch(_) {}
const withTelegramData = o => (o.initData = tgInit, o);

// === Sections & headers
const start   = document.getElementById('start');
const audit   = document.getElementById('audit');
const webinar = document.getElementById('webinar');
const titleEl = document.querySelector('h1');
const subEl   = document.querySelector('.sub');

// === Навигация
document.getElementById('goAudit').onclick = () => {
  start.style.display = 'none';
  audit.style.display = 'block';
  webinar.style.display = 'none';
  if (titleEl) titleEl.textContent = 'Аудит печатной инфраструктуры';
  if (subEl) subEl.style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

document.getElementById('goWebinar').onclick = () => {
  start.style.display = 'none';
  webinar.style.display = 'block';
  audit.style.display = 'none';
  if (titleEl) titleEl.textContent = 'Выбор темы вебинара';
  if (subEl) subEl.style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// === Audit logic
const f = document.getElementById('f');
const flds = f ? [...document.querySelectorAll('fieldset.q')] : [];
const total = flds.length;
const progressText = document.getElementById('progressText');
const sendMsg = document.getElementById('sendMsg');

function answered(){ return flds.reduce((n,fs)=>n+(fs.querySelector('input:checked')?1:0),0); }
function updateProgress(){ if(progressText) progressText.textContent = `Вопрос ${answered()} из ${total}`; }
if (f){
  f.addEventListener('click', e=>{
    const lab=e.target.closest('.opt'); if(!lab) return;
    const inp=lab.querySelector('input');
    if (inp && !inp.checked){ inp.checked=true; updateProgress(); }
  }, {passive:true});
  f.addEventListener('change', e=>{ if(e.target.matches('input[type="radio"]')) updateProgress(); }, {passive:true});
}

// === Отправка на GAS (только аудит/лиды)
function send(obj){
  const json = JSON.stringify(obj);
  try{
    if(navigator.sendBeacon){
      const blob = new Blob([json], { type:'text/plain;charset=UTF-8' });
      const ok = navigator.sendBeacon(HOOK, blob);
      if (ok) return;
    }
  }catch(_){}
  try{
    const b64 = btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const url = HOOK + (HOOK.includes('?')?'&':'?') + 'p=' + b64;
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), 1200);
    fetch(url, { method:'GET', mode:'no-cors', keepalive:true, cache:'no-store', signal:ctrl.signal })
      .catch(()=>{}).finally(()=>clearTimeout(t));
  }catch(_){}
}

// Warm-up GAS для аудита/лидов
window.addEventListener('load', ()=>{
  try{ send({type:'trace',stage:'loaded',t:new Date().toISOString()}); }catch(_){}
  renderLocalSummary(); // показать сводку по темам
});

// Submit audit
const submitBtn = document.getElementById('submitBtn');
if (submitBtn){
  submitBtn.addEventListener('click', e=>{
    e.preventDefault();
    const ans={},fs=flds;let s=0;
    fs.forEach((fld,i)=>{ const c=fld.querySelector('input:checked'); const v=Number(c?c.value:0); ans['q'+(i+1)]=v; if(v===1)s++; });
    const verdict = s>=8 ? 'Зрелая инфраструктура' : s>=5 ? 'Контроль частичный' : 'Высокая уязвимость';
    const advice  = s>=8 ? 'Точечный аудит TCO и поддержание уровня.'
                         : s>=5 ? 'Пересмотр бюджета и KPI (TCO, SLA).'
                                : 'Экспресс-аудит, инвентаризация, быстрые меры экономии.';
    const payload = withTelegramData({ type:'result', score:s, verdict, advice, answers:ans, t:new Date().toISOString() });
    send(payload);
    if (sendMsg){ sendMsg.style.display='block'; sendMsg.textContent='✅ Результаты отправлены!'; setTimeout(()=>sendMsg.style.display='none',3000); }
    document.getElementById('resTitle').textContent = `Ваш результат: ${s}/${total} — ${verdict}`;
    document.getElementById('resText').textContent  = advice;
    const res = document.getElementById('res'); res.style.display='block';
    setTimeout(()=>res.scrollIntoView({behavior:'smooth',block:'start'}),30);
  });
}

// Lead form
const ctaContact = document.getElementById('ctaContact');
if (ctaContact){
  ctaContact.addEventListener('click', e=>{
    e.preventDefault();
    const lf=document.getElementById('leadForm'); lf.style.display='block';
    lf.scrollIntoView({behavior:'smooth',block:'start'});
  });
}
const sendLeadBtn = document.getElementById('sendLead');
if (sendLeadBtn){
  sendLeadBtn.addEventListener('click', e=>{
    e.preventDefault();
    const name=document.getElementById('name').value.trim();
    const company=document.getElementById('company').value.trim();
    const phone=document.getElementById('phone').value.trim();
    const comment=document.getElementById('comment').value.trim();
    const lead=withTelegramData({type:'lead',name,company,phone,comment,consent:true,policyUrl:'https://lekom.ru/politika-konfidencialnosti/',t:new Date().toISOString()});
    send(lead);
    document.getElementById('leadMsg').style.display='block';
    sendLeadBtn.disabled=true;
  });
}

// === WEBINAR POLL (локально, без сети) ===
const WB_KEY = 'lekom_webinar_poll_v1';

function readPoll(){
  try{ return JSON.parse(localStorage.getItem(WB_KEY) || '{}'); }catch(_){ return {}; }
}
function writePoll(data){
  try{ localStorage.setItem(WB_KEY, JSON.stringify(data)); }catch(_){}
}
function addVote(topic, otherText){
  const db = readPoll();
  const key = topic === 'Другая тема' ? (otherText || 'Другая тема') : topic;
  db[key] = (db[key] || 0) + 1;
  writePoll(db);
  return db;
}
function summaryFromLocal(){
  const db = readPoll();
  const items = Object.keys(db).map(k=>({ topic:k, count:db[k] })).sort((a,b)=>b.count-a.count);
  const total = items.reduce((s,i)=>s+i.count,0);
  return { total, items };
}
function renderLocalSummary(){
  const box = document.getElementById('summaryBody');
  if (!box) return;
  const { total, items } = summaryFromLocal();
  if (!total){ box.textContent = 'Пока нет голосов.'; return; }

  // рисуем список с мини-барами
  const frag = document.createDocumentFragment();
  const totalDiv = document.createElement('div');
  totalDiv.innerHTML = `Всего голосов: <b>${total}</b>`;
  frag.appendChild(totalDiv);

  const list = document.createElement('div');
  list.className = 'mt';
  items.forEach(it=>{
    const pct = Math.round(it.count*100/total);
    const row = document.createElement('div');
    row.className = 'mt';
    row.innerHTML = `<div class="grid">
        <div>${it.topic}</div><div>${it.count} (${pct}%)</div>
      </div>
      <div class="bar"><i style="width:${pct}%"></i></div>`;
    list.appendChild(row);
  });
  frag.appendChild(list);

  box.innerHTML = '';
  box.appendChild(frag);
}

const wbOtherRadio = document.getElementById('wbOtherRadio');
const wbOtherText  = document.getElementById('wbOtherText');
const webinarOptions = document.getElementById('webinarOptions');
if (webinarOptions){
  webinarOptions.addEventListener('change', ()=>{
    const isOther = wbOtherRadio && wbOtherRadio.checked;
    if (wbOtherText) wbOtherText.style.display = isOther ? 'block' : 'none';
  });
}
const sendWebinar = document.getElementById('sendWebinar');
if (sendWebinar){
  sendWebinar.addEventListener('click', ()=>{
    const c = document.querySelector('input[name="webinar"]:checked');
    if(!c){ alert('Выберите вариант'); return; }
    const topic = c.value;
    let other = '';
    if (topic === 'Другая тема'){
      other = (wbOtherText?.value || '').trim();
      if (other.length < 3){ alert('Пожалуйста, укажите тему (минимум 3 символа)'); return; }
    }
    // ЛОКАЛЬНАЯ запись голоса
    addVote(topic, other);
    document.getElementById('webinarMsg').style.display='block';
    sendWebinar.disabled = true;
  });
}

// === Reset & Back ===
function resetAudit(){
  flds.forEach(fs=>{
    const checked = fs.querySelector('input:checked');
    if (checked) checked.checked = false;
  });
  const res = document.getElementById('res'); if (res) res.style.display='none';
  const lf  = document.getElementById('leadForm'); if (lf) lf.style.display='none';
  ['name','company','phone','comment'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  const leadMsg = document.getElementById('leadMsg'); if (leadMsg) leadMsg.style.display='none';
  if (sendLeadBtn) sendLeadBtn.disabled=false;
  if (progressText) progressText.textContent = `Вопрос 0 из ${total}`;
  if (sendMsg) sendMsg.style.display='none';
}
function resetWebinar(){
  const radios = document.querySelectorAll('input[name="webinar"]');
  radios.forEach(r=>r.checked=false);
  if (wbOtherText){ wbOtherText.value=''; wbOtherText.style.display='none'; }
  const webinarMsg = document.getElementById('webinarMsg'); if (webinarMsg) webinarMsg.style.display='none';
  if (sendWebinar) sendWebinar.disabled=false;
}
function goHome(){
  resetAudit();
  resetWebinar();
  audit.style.display='none';
  webinar.style.display='none';
  start.style.display='block';
  if (titleEl) titleEl.textContent = 'ЛЕКОМ · Интерактив';
  if (subEl) subEl.style.display = 'block';
  window.scrollTo({top:0,behavior:'smooth'});
  renderLocalSummary(); // обновить сводку
}
['backHomeFromAudit','backHomeFromAuditTop','backHomeFromWebinar','backHomeFromWebinarTop']
  .forEach(id=>{
    const el = document.getElementById(id);
    if (el) {
      el.textContent = '↩️ Вернуться';
      el.addEventListener('click', (e)=>{ e.preventDefault(); goHome(); });
    }
  });
