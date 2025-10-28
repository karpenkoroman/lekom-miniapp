// === SETTINGS ===
const HOOK = 'https://script.google.com/macros/s/AKfycbzUnezeA6Pu2-ol6UVUkZpqfBIpEyji09dMGbkk6m4-Iu2-3-KwxZkLTrkoHGHRcIqN/exec';
const SUMMARY_URL = HOOK + (HOOK.includes('?') ? '&' : '?') + 'summary=webinar&callback=__LEKOM_SUMMARY_CB';

// === Telegram initData
let tgInit = {};
try {
  if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.ready();
    tgInit = window.Telegram.WebApp.initDataUnsafe || {};
  }
} catch(_) {}
const withTelegramData = o => (o.initData = tgInit, o);

// === DOM
const start   = document.getElementById('start');
const audit   = document.getElementById('audit');
const webinar = document.getElementById('webinar');
const titleEl = document.querySelector('h1');
const subEl   = document.querySelector('.sub');

// === Навигация
document.getElementById('goAudit').onclick = () => {
  start.style.display='none'; audit.style.display='block'; webinar.style.display='none';
  if (titleEl) titleEl.textContent='Аудит печатной инфраструктуры';
  if (subEl) subEl.style.display='none';
  window.scrollTo({top:0,behavior:'smooth'});
};
document.getElementById('goWebinar').onclick = () => {
  start.style.display='none'; webinar.style.display='block'; audit.style.display='none';
  if (titleEl) titleEl.textContent='Выбор темы вебинара';
  if (subEl) subEl.style.display='none';
  window.scrollTo({top:0,behavior:'smooth'});
};

// === Audit
let lastResult = null;
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

// === Универсальная отправка в GAS через GET ?q= (без дублей и CORS)
function sendQ(obj){
  const url = HOOK + (HOOK.includes('?')?'&':'?') + 'q=' + encodeURIComponent(JSON.stringify(obj));
  const s = document.createElement('script'); // JSONP-like для WebView
  s.src = url + '&_=' + Date.now();
  s.async = true;
  document.head.appendChild(s);
}

// === JSONP сводка (только темы и счёт)
window.__LEKOM_SUMMARY_CB = function(data){
  const box = document.getElementById('summaryBody'); if(!box) return;
  const total = data?.total || 0;
  const items = Array.isArray(data?.items) ? data.items : [];
  if (!total){ box.textContent = 'Пока нет голосов.'; return; }
  const lines = items.map(it=>{
    const pct = Math.round(it.count*100/total);
    return `<div class="mt">
      <div class="grid"><div>${it.topic}</div><div>${it.count} (${pct}%)</div></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
    </div>`;
  }).join('');
  box.innerHTML = `Всего голосов: <b>${total}</b><div class="mt">${lines}</div>`;
};
function loadSummary(){
  const s=document.createElement('script');
  s.src = SUMMARY_URL + '&_=' + Date.now();
  s.async = true;
  document.head.appendChild(s);
}
window.addEventListener('load', ()=>{
  try{ sendQ({type:'trace',stage:'loaded',t:new Date().toISOString()}); }catch(_){}
  loadSummary();
});

// === Submit audit
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
    lastResult = { score:s, verdict, advice, answers:ans };

    sendQ(withTelegramData({ type:'result', ...lastResult, t:new Date().toISOString() }));

    if (sendMsg){ sendMsg.style.display='block'; sendMsg.textContent='✅ Результаты отправлены!'; setTimeout(()=>sendMsg.style.display='none',3000); }
    document.getElementById('resTitle').textContent = `Ваш результат: ${s}/${total} — ${verdict}`;
    document.getElementById('resText').textContent  = advice;
    const res = document.getElementById('res'); res.style.display='block';
    setTimeout(()=>res.scrollIntoView({behavior:'smooth',block:'start'}),30);
  });
}

// === Обсудить с экспертом: копирование текста + открытие чата + всплывающая подсказка ===
const ctaExpert = document.getElementById('ctaExpert');

function composeExpertMsg() {
  const s = lastResult?.score ?? '—';
  const v = lastResult?.verdict || '—';
  const a = lastResult?.advice || '';
  return `Здравствуйте! Хочу обсудить аудит печати.
Счёт: ${s}/${total}
Вердикт: ${v}
Комментарий: ${a}`;
}

function openTG(url) {
  try {
    if (window.Telegram?.WebApp?.openTelegramLink) {
      Telegram.WebApp.openTelegramLink(url);
      return true;
    }
  } catch (_) {}
  window.location.href = url;
  return true;
}

async function copyMsgToClipboard(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { return false; }
}

function showToast(message) {
  let toast = document.createElement('div');
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '25px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.8)',
    color: '#fff',
    padding: '10px 18px',
    borderRadius: '12px',
    fontSize: '15px',
    zIndex: 9999,
    opacity: 0,
    transition: 'opacity 0.3s ease'
  });
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = 1; }, 50);
  setTimeout(() => {
    toast.style.opacity = 0;
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

function openExpertChat() {
  openTG('tg://resolve?domain=chelebaev');
  setTimeout(() => openTG('https://t.me/chelebaev'), 700);
}

if (ctaExpert) {
  ctaExpert.addEventListener('click', async (e) => {
    e.preventDefault();
    const msg = composeExpertMsg();
    const copied = await copyMsgToClipboard(msg);
    showToast('💬 Текст сообщения скопирован, вставьте в чат и отправьте');
    openExpertChat();
  });
}

// === Lead form
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
    const leadPayload = {
      type:'lead',
      name, company, phone, comment,
      consent:true, policyUrl:'https://lekom.ru/politika-konfidencialnosti/',
      result: lastResult || null,
      t:new Date().toISOString()
    };
    sendQ(withTelegramData(leadPayload));
    document.getElementById('leadMsg').style.display='block';
    sendLeadBtn.disabled=true;
  });
}

// === Webinar poll (общий счёт в Google)
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
    // отправка + мягкий антидребезг кнопки (1.2 сек)
    sendQ(withTelegramData({ type:'poll', poll:'webinar_topic', topic, other, t:new Date().toISOString() }));
    document.getElementById('webinarMsg').style.display='block';
    sendWebinar.disabled = true;
    setTimeout(()=>{ sendWebinar.disabled = false; }, 1200);

    // обновим сводку
    setTimeout(loadSummary, 800);
  });
}

// === Reset & Back
function resetAudit(){
  flds.forEach(fs=>{ const ch = fs.querySelector('input:checked'); if(ch) ch.checked=false; });
  const res = document.getElementById('res'); if(res) res.style.display='none';
  const lf  = document.getElementById('leadForm'); if(lf) lf.style.display='none';
  ['name','company','phone','comment'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  const leadMsg = document.getElementById('leadMsg'); if(leadMsg) leadMsg.style.display='none';
  if (sendLeadBtn) sendLeadBtn.disabled=false;
  if (progressText) progressText.textContent = `Вопрос 0 из ${total}`;
  if (sendMsg) sendMsg.style.display='none';
  lastResult = null;
}
function resetWebinar(){
  const radios = document.querySelectorAll('input[name="webinar"]');
  radios.forEach(r=>r.checked=false);
  if (wbOtherText){ wbOtherText.value=''; wbOtherText.style.display='none'; }
  const webinarMsg = document.getElementById('webinarMsg'); if (webinarMsg) webinarMsg.style.display='none';
  if (sendWebinar) sendWebinar.disabled=false;
}
function goHome(){
  resetAudit(); resetWebinar();
  audit.style.display='none'; webinar.style.display='none'; start.style.display='block';
  if (titleEl) titleEl.textContent = 'ЛЕКОМ · Интерактив';
  if (subEl) subEl.style.display = 'block';
  window.scrollTo({top:0,behavior:'smooth'});
  loadSummary();
}
['backHomeFromAudit','backHomeFromAuditTop','backHomeFromWebinar','backHomeFromWebinarTop'].forEach(id=>{
  const el=document.getElementById(id);
  if(el){ el.textContent='↩️ Вернуться'; el.addEventListener('click', e=>{ e.preventDefault(); goHome(); }); }
});
