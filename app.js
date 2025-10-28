/* =========================
   Lekom MiniApp — app.js
   ========================= */

// === 1) НАСТРОЙКИ ===
const HOOK = window.LEKOM_HOOK || 'https://script.google.com/macros/s/AKfycbzUnezeA6Pu2-ol6UVUkZpqfBIpEyji09dMGbkk6m4-Iu2-3-KwxZkLTrkoHGHRcIqN/exec'; // можно пробросить через глобал
const TELEGRAM = window.Telegram?.WebApp;

// === 2) ГЛОБАЛЬНОЕ СОСТОЯНИЕ (минимум) ===
let lastResult = null; // сюда положим {score, verdict, advice, answers}
let total = 11;        // кол-во вопросов аудита (обнови при необходимости)

// === 3) УТИЛИТЫ ЭКРАНОВ ===
function show(el){ if(el) el.style.display=''; }
function hide(el){ if(el) el.style.display='none'; }
function byId(id){ return document.getElementById(id); }
function goScreen(screen){
  const ids = ['start','audit','webinar'];
  ids.forEach(i => hide(byId(i)));
  show(byId(screen));
  // Авто-скролл в начало экрана
  byId(screen)?.scrollIntoView({ behavior:'smooth', block:'start' });
}

// === 4) ТОСТ-УВЕДОМЛЕНИЕ (заметное, сверху) ===
function showToast(message, ms = 6000) {
  const toast = document.createElement('div');
  toast.innerHTML = `💬 ${message}`;
  Object.assign(toast.style, {
    position: 'fixed',
    top: `calc(env(safe-area-inset-top, 0px) + 14px)`,
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#111',
    color: '#fff',
    padding: '14px 18px',
    borderRadius: '12px',
    fontSize: '16px',
    lineHeight: '1.25',
    maxWidth: '92vw',
    textAlign: 'center',
    boxShadow: '0 8px 24px rgba(0,0,0,.28)',
    zIndex: 99999,
    opacity: 0,
    transition: 'opacity .25s ease, transform .25s ease',
    cursor: 'pointer'
  });
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; });
  const hideFn = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-6px)';
    setTimeout(() => toast.remove(), 250);
  };
  toast.addEventListener('click', hideFn);
  const t = setTimeout(hideFn, ms);
  window.addEventListener('beforeunload', ()=>clearTimeout(t), {once:true});
}

// === 5) TELEGRAM HELPERS ===
function openTG(url){
  try{
    if (TELEGRAM?.openTelegramLink){ TELEGRAM.openTelegramLink(url); return true; }
  }catch(_){}
  window.location.href = url; return true;
}
async function copyToClipboard(text){
  try{ await navigator.clipboard.writeText(text); return true; } catch{ return false; }
}

// === 6) СТАРТОВЫЙ ЭКРАН + СВОДКА ПО ТЕМАМ ===
const SUMMARY_TARGET_ID = 'summaryStart';

function renderSummaryTo(targetId, data){
  const box = byId(targetId);
  if (!box) return;
  box.innerHTML = '';
  if (!data || !data.items || !data.items.length){
    box.textContent = 'Пока нет голосов.';
    return;
  }
  const totalVotes = Number(data.total || 0);
  const head = document.createElement('div');
  head.style.marginBottom = '6px';
  head.style.color = 'rgba(255,255,255,.75)';
  head.textContent = `Всего голосов: ${totalVotes}`;
  box.appendChild(head);

  data.items
    .slice()
    .sort((a,b)=>b.count-a.count)
    .forEach(({topic, count})=>{
      const row = document.createElement('div');
      row.className = 'mt';
      const pct = totalVotes ? Math.round(count*100/totalVotes) : 0;
      row.innerHTML = `
        <div class="grid"><span>${topic}</span><span>${count} (${pct}%)</span></div>
        <div class="bar"><i style="width:${pct}%"></i></div>
      `;
      box.appendChild(row);
    });
}

function loadWebinarSummary(){
  // чистим предыдущий JSONP
  const old = byId('__lekom_jsonp');
  if (old) old.remove();

  window.__LEKOM_SUMMARY_CB = (data)=>renderSummaryTo(SUMMARY_TARGET_ID, data);
  const s = document.createElement('script');
  s.id = '__lekom_jsonp';
  s.src = `${HOOK}?summary=webinar&callback=__LEKOM_SUMMARY_CB&_=${Date.now()}`;
  document.body.appendChild(s);
}

function showStart(){
  goScreen('start');
  loadWebinarSummary();
}

// === 7) ОБРАБОТЧИК «ОБСУДИТЬ С ЭКСПЕРТОМ» ===
function composeExpertMsg(){
  const s = lastResult?.score ?? '—';
  const v = lastResult?.verdict || '—';
  const a = lastResult?.advice || '';
  return `Здравствуйте! Хочу обсудить аудит печати.
Счёт: ${s}/${total}
Вердикт: ${v}
Комментарий: ${a}`;
}

function hookExpertCta(){
  const cta = byId('ctaExpert');
  if (!cta) return;
  cta.addEventListener('click', async (e)=>{
    e.preventDefault();
    const msg = composeExpertMsg();
    showToast('Текст сообщения скопирован, вставьте в чат и отправьте', 6000);
    await copyToClipboard(msg);
    // deep-link → фоллбек
    openTG('tg://resolve?domain=chelebaev');
    setTimeout(()=>openTG('https://t.me/chelebaev'), 700);
  });
}

// === 8) ОТПРАВКА ДАННЫХ В GAS ===
let clickLock = false;
function lockClicks(ms=900){ if(clickLock) return false; clickLock=true; setTimeout(()=>clickLock=false, ms); return true; }

async function postJSON(obj){
  const qs = new URLSearchParams({ q: JSON.stringify(obj) }).toString();
  const url = `${HOOK}?${qs}`;
  const r = await fetch(url, { method:'GET' }); // JSONP/GET — надёжнее для MiniApp
  return r.text();
}

// Результат аудита
async function sendResult(resultObj){
  if (!lockClicks()) return;
  const payload = {
    type:'result',
    score: resultObj.score,
    verdict: resultObj.verdict,
    advice: resultObj.advice,
    answers: resultObj.answers || null,
    t: new Date().toISOString(),
    initData: TELEGRAM?.initDataUnsafe || {}
  };
  try{
    await postJSON(payload);
    lastResult = { score: payload.score, verdict: payload.verdict, advice: payload.advice, answers: payload.answers };
    showToast('Результат отправлен — прокрутил к итогу');
    // Показываем блок результата, если он есть
    byId('resultBlock')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }catch(_){
    showToast('Не удалось отправить результат. Проверьте сеть.');
  }
}

// Лид (контакт)
async function sendLead(lead){
  if (!lockClicks()) return;
  const payload = {
    type:'lead',
    name: lead.name || '',
    company: lead.company || '',
    phone: lead.phone || '',
    comment: lead.comment || '',
    consent: !!lead.consent,
    policyUrl: 'https://lekom.ru/politika-konfidencialnosti/',
    result: lastResult || {},
    utm_source: lead.utm_source || '',
    utm_medium:  lead.utm_medium || '',
    utm_campaign: lead.utm_campaign || '',
    t: new Date().toISOString(),
    initData: TELEGRAM?.initDataUnsafe || {}
  };
  try{
    await postJSON(payload);
    showToast('Контакт отправлен. Мы свяжемся с вами.');
  }catch(_){
    showToast('Не удалось отправить контакт. Проверьте сеть.');
  }
}

// Голос по теме вебинара
async function sendWebinarVote(topic, otherText=''){
  if (!lockClicks()) return;
  const payload = {
    type:'poll',
    poll:'webinar_topic',
    topic,
    other: otherText || '',
    t: new Date().toISOString(),
    initData: TELEGRAM?.initDataUnsafe || {}
  };
  try{
    await postJSON(payload);
    showToast('Голос учтён!');
    // обновим сводку после голосования
    setTimeout(loadWebinarSummary, 600);
  }catch(_){
    showToast('Не удалось отправить голос. Повторите позже.');
  }
}

// === 9) ПРИВЯЗКИ КНОПОК СТАРТА ===
function bindStartButtons(){
  byId('goAudit')?.addEventListener('click', ()=>{
    goScreen('audit');
    // здесь должен запускаться ваш рендер/логика опроса аудита
    // (после завершения нужно вызвать sendResult({...}))
  });
  byId('goWebinar')?.addEventListener('click', ()=>{
    goScreen('webinar');
    // на экране webinar повесь клики на варианты:
    // document.querySelectorAll('[data-topic]').forEach(btn=>{
    //   btn.addEventListener('click', ()=> sendWebinarVote(btn.dataset.topic));
    // });
  });

  // Кнопки "Вернуться" на внутренних экранах (если есть)
  byId('btnBackAudit')?.addEventListener('click', showStart);
  byId('btnBackWebinar')?.addEventListener('click', showStart);
}

// === 10) ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', ()=>{
  // Telegram UI улучшалки
  try{
    TELEGRAM?.ready();
    TELEGRAM?.expand();
  }catch(_){}

  hookExpertCta();
  bindStartButtons();
  showStart(); // загрузит сводку на старте
});

// === 11) Экспорт функций (если вызываешь из HTML онкликами)
window.LEKOM = {
  sendResult,   // LEKOM.sendResult({score, verdict, advice, answers})
  sendLead,     // LEKOM.sendLead({name,company,phone,comment,consent})
  sendWebinarVote,
  showStart
};
