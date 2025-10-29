// ================== Глобальные ==================
const HOOK = window.LEKOM_HOOK;
const TOTAL_Q = 11;
let SENDING_POLL = false;

// Показ экранов
function show(id) {
  ['screen-start','screen-audit','screen-poll'].forEach(x=>{
    const el = document.getElementById(x);
    if (el) el.style.display = (x===id)?'block':'none';
  });
}
['goAudit','goPoll','backStart1','backStart2'].forEach(id=>{
  const e = document.getElementById(id);
  if(!e) return;
  e.onclick = () => {
    if (id === 'goAudit') show('screen-audit');
    else if (id === 'goPoll') show('screen-poll');
    else show('screen-start');
  };
});

// ================== Модалки ==================
function showModal(html, onOk) {
  const o = document.createElement('div');
  o.className = 'toast-overlay';
  o.innerHTML = `
    <div class="toast-box">
      ${html}
      <br><br>
      <div class="btn btn-primary" id="__ok">ОК</div>
    </div>`;
  document.body.appendChild(o);
  const close = () => { o.remove(); if (typeof onOk === 'function') onOk(); };
  o.addEventListener('click', (e)=>{ if (e.target.id==='__ok' || e.target===o) close(); });
}
function showSpinner(text='Отправляем…') {
  const o = document.createElement('div');
  o.className = 'toast-overlay';
  o.innerHTML = `
    <div class="toast-box">
      <div style="margin-bottom:10px">${text}</div>
      <div class="muted">Пожалуйста, подождите</div>
    </div>`;
  document.body.appendChild(o);
  return () => o.remove();
}

// ================== Надёжная отправка в HOOK ==================
// Любой ответ, который доехал (без сетевой ошибки), считаем успешным.
// Это убирает ложные "ошибки" из-за редиректов/пустых ответов Apps Script.
async function sendToHook(payload) {
  const init = (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) || null;
  if (init && !payload.initData) payload.initData = init;

  const ts = Date.now();

  const postUrl = HOOK + (HOOK.includes('?') ? '&' : '?') + '_ts=' + ts;
  const u = new URL(HOOK);
  u.searchParams.set('q', JSON.stringify(payload));
  u.searchParams.set('_ts', ts);

  try {
    // Параллельно POST и (через 200 мс) GET, берём первый завершившийся
    const postP = fetch(postUrl, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload), mode:'cors', credentials:'omit'});
    const getP  = new Promise(res => setTimeout(()=> res(fetch(u.toString(), {method:'GET'})), 200));

    await Promise.race([postP, getP]);
    // Даже если статус 30x/текст пустой — ок.
    return true;
  } catch(_) {
    // Только реальная сетевая ошибка
    return false;
  }
}

// ================== Сводка опроса ==================
async function getSummaryRobust() {
  if (!HOOK) return null;

  const normalize = (data) => {
    if (!data) return null;
    if (Array.isArray(data)) {
      return data.map(x => ({ label: (x.label ?? x.topic ?? '').toString(), count: Number(x.count || 0) }));
    }
    if (data.items && Array.isArray(data.items)) {
      return data.items.map(x => ({ label: (x.label ?? x.topic ?? '').toString(), count: Number(x.count || 0) }));
    }
    return null;
  };

  const tryParse = (txt) => {
    try { return JSON.parse(txt); } catch(_){}
    const m = txt.match(/\{.*\}|\[.*\]/s);
    if (m) { try { return JSON.parse(m[0]); } catch(_){ } }
    return null;
  };

  try {
    const a = new URL(HOOK); a.searchParams.set('summary','webinar'); a.searchParams.set('_', Date.now());
    let r = await fetch(a.toString()); let t = await r.text(); let d = normalize(tryParse(t)); if (d && d.length) return d;

    const b = new URL(HOOK); b.searchParams.set('summary','webinar'); b.searchParams.set('format','json'); b.searchParams.set('_', Date.now());
    r = await fetch(b.toString()); t = await r.text(); d = normalize(tryParse(t)); if (d && d.length) return d;

    const cb = '__LEKOM_SUMMARY_CB_' + Math.random().toString(36).slice(2);
    d = await new Promise((resolve,reject)=>{
      window[cb] = (x)=>resolve(x);
      const s = document.createElement('script');
      const u = new URL(HOOK);
      u.searchParams.set('summary','webinar'); u.searchParams.set('callback',cb); u.searchParams.set('_', Date.now());
      s.src = u.toString(); s.onerror=()=>reject(new Error('jsonp-error'));
      document.head.appendChild(s); setTimeout(()=>reject(new Error('jsonp-timeout')),6000);
    });
    d = normalize(d); if (d && d.length) return d;
  } catch(_){}

  return null;
}

function renderSummary(data) {
  const box = document.getElementById('summaryContent');
  if (!box) return;
  if (!data || !data.length) { box.innerHTML = '<div class="muted">Нет данных.</div>'; return; }

  const arr = [...data].sort((a,b)=> (b.count||0) - (a.count||0));
  const tot = arr.reduce((a,x)=>a+(Number(x.count)||0),0);

  box.innerHTML = `<div class="muted">Всего голосов: <b>${tot}</b></div>` + arr.map(x=>{
    const c = Number(x.count)||0;
    const pct = tot ? Math.round(c*100/tot) : 0;
    const label = x.label || '';
    return `
      <div class="summary-row">
        <div class="summary-head">
          <div>${label}</div>
          <div class="muted">${c} (${pct}%)</div>
        </div>
        <div class="summary-bar"><div class="summary-fill" style="width:${pct}%"></div></div>
      </div>`;
  }).join('');
}

// Оптимистичный +1 и форс-рефреш
function bumpSummary(selectedTopics, otherText) {
  const box = document.getElementById('summaryContent'); if (!box) return;

  const rows = [...box.querySelectorAll('.summary-row')]; if (!rows.length) return;
  const labels = rows.map(r => r.querySelector('.summary-head div').textContent.trim());
  const counts = rows.map(r => {
    const t = r.querySelector('.summary-head .muted').textContent;
    const n = parseInt(t, 10); return isNaN(n) ? 0 : n;
  });

  const L_OBZOR='Обзор рынка и тренды 2025', L_IMPORT='Импортозамещение (техника, софт, расходники)',
        L_ZAKUP='Закупки по 44-ФЗ / 223-ФЗ', L_CART='Рынок картриджей — есть ли жизнь после OEM?', L_OTHER='Другая тема';

  const mapTopicToLabel = (t) => {
    const s=(t||'').toLowerCase();
    if (s.includes('тренд')||s.includes('обзор')) return L_OBZOR;
    if (s.includes('импорт')) return L_IMPORT;
    if (s.includes('44-фз')||s.includes('223-фз')||s.includes('закуп')) return L_ZAKUP;
    if (s.includes('картридж')||s.includes('oem')) return L_CART;
    return L_OTHER;
  };
  const indexOf = (lbl)=> labels.findIndex(l=>l.toLowerCase()===lbl.toLowerCase());
  const inc = (lbl)=>{ const i=indexOf(lbl); if(i>=0) counts[i]=(counts[i]||0)+1; };

  (selectedTopics||[]).forEach(t=>inc(mapTopicToLabel(t)));
  if (otherText) inc(L_OTHER);

  const data = labels.map((l,i)=>({label:l,count:counts[i]||0}));
  renderSummary(data);
}
async function refreshSummaryNow() {
  const s1 = await getSummaryRobust(); if (s1 && s1.length) return renderSummary(s1);
  setTimeout(async()=>{ const s2=await getSummaryRobust(); if(s2 && s2.length) renderSummary(s2); }, 700);
  setTimeout(async()=>{ const s3=await getSummaryRobust(); if(s3 && s3.length) renderSummary(s3); }, 2200);
  setTimeout(async()=>{ const s4=await getSummaryRobust(); if(s4 && s4.length) renderSummary(s4); }, 5000);
}

// Бутстрап сводки
try{
  renderSummary([
    {label:'Обзор рынка и тренды 2025', count:0},
    {label:'Импортозамещение (техника, софт, расходники)', count:0},
    {label:'Закупки по 44-ФЗ / 223-ФЗ', count:0},
    {label:'Рынок картриджей — есть ли жизнь после OEM?', count:0},
    {label:'Другая тема', count:0}
  ]);
  (async function boot(){
    const s1=await getSummaryRobust(); if(s1&&s1.length) renderSummary(s1);
    setTimeout(async()=>{ const s2=await getSummaryRobust(); if(s2&&s2.length) renderSummary(s2); },1500);
    setTimeout(async()=>{ const s3=await getSummaryRobust(); if(s3&&s3.length) renderSummary(s3); },6000);
  })();
  setInterval(async()=>{ const s=await getSummaryRobust(); if(s&&s.length) renderSummary(s); },20000);
}catch(_){}

// ================== Аудит ==================
const auditForm   = document.getElementById('auditForm');
const prog        = document.getElementById('auditProgress');
const btnResult   = document.getElementById('btnAuditResult');
const btnAuditSub = document.getElementById('btnAuditSub');

updateAuditCounters();

auditForm.addEventListener('click', (e)=>{
  const b = e.target.closest('.pill'); if(!b) return;
  const q = b.dataset.q;
  auditForm.querySelectorAll(`.pill[data-q="${q}"]`).forEach(x=>x.classList.remove('selected'));
  b.classList.add('selected');
  updateAuditCounters();
});

function updateAuditCounters() {
  const answered = new Set([...auditForm.querySelectorAll('.pill.selected')].map(x => x.dataset.q)).size;
  if (prog) prog.textContent = `Ответы: ${answered} / ${TOTAL_Q}`;
  if (btnAuditSub) btnAuditSub.textContent = `(ответов ${answered} из ${TOTAL_Q})`;
}

function calcAudit() {
  let score = 0;
  const answers = {};
  for (let i=1;i<=TOTAL_Q;i++){
    const sel = auditForm.querySelector(`.pill.selected[data-q="q${i}"]`);
    if (sel) { answers['q'+i] = sel.textContent.trim(); score += Number(sel.dataset.score||0); }
    else     { answers['q'+i] = null; }
  }
  let verdict, advice;
  if (score >= 9) { verdict='Зрелая инфраструктура'; advice='Можно оптимизировать закупки и мониторинг.'; }
  else if (score >= 5) { verdict='Частичный контроль'; advice='Рекомендуем TCO-аудит и политику печати.'; }
  else { verdict='Нужен аудит'; advice='Нужен пересмотр парка и бюджета.'; }
  return { score, verdict, advice, answers };
}

btnResult.onclick = async ()=>{
  const res = calcAudit();

  const html =
    `<span class="result-score"><b>${res.score}</b> из ${TOTAL_Q}</span><br>` +
    `Вердикт: <b>${res.verdict}</b><br><span class="muted">${res.advice}</span>`;
  document.getElementById('resultText').innerHTML = html;

  document.getElementById('resultCard').scrollIntoView({ behavior:'smooth', block:'start' });

  // Тихая отправка — без ошибок в UI
  await sendToHook({ type:'result', score:res.score, verdict:res.verdict, advice:res.advice, answers:res.answers });

  window.__lastAuditResult = res;
};

// ================== Лиды ==================
document.getElementById('toggleLead').onclick = ()=>{
  const f = document.getElementById('leadForm');
  f.style.display = 'block';
  f.scrollIntoView({ behavior:'smooth', block:'start' });
};

document.getElementById('sendLead').onclick = async ()=>{
  const res = window.__lastAuditResult || {};
  const qs = new URLSearchParams(location.search);

  const payload = {
    type: 'lead',
    name:   document.getElementById('leadName').value.trim(),
    company:document.getElementById('leadCompany').value.trim(),
    phone:  document.getElementById('leadPhone').value.trim(),
    comment:'',
    utm_source: qs.get('utm_source') || '',
    utm_medium: qs.get('utm_medium') || '',
    utm_campaign: qs.get('utm_campaign') || '',
    result: res
  };

  const hide = showSpinner('Отправляем…');
  await sendToHook(payload); // успех по умолчанию
  hide();

  document.getElementById('leadForm').style.display = 'none';
  document.getElementById('resultText').innerHTML = `<b>Спасибо!</b> Контакты отправлены.`;
};

// ================== Обсудить с экспертом ==================
document.getElementById('ctaExpert').onclick = async ()=>{
  const r = window.__lastAuditResult;
  const msg = r
    ? `Здравствуйте! Хочу обсудить аудит печати.\nСчёт: ${r.score}/${TOTAL_Q}, вердикт: ${r.verdict}.`
    : `Здравствуйте! Хочу обсудить аудит печати.`;
  try { await navigator.clipboard.writeText(msg); } catch(_){}
  showModal(
    `Текст скопирован.<br>Нажмите «ОК», откроется диалог с Игорем Челебаевым, затем вставьте сообщение и отправьте.`,
    () => { window.location.href = 'https://t.me/chelebaev'; }
  );
};

// ================== Голосование (мультивыбор) ==================
const pollForm = document.getElementById('pollForm');
pollForm.addEventListener('click', (e)=>{
  const b = e.target.closest('.pill'); if(!b) return;
  b.classList.toggle('selected');
});

document.getElementById('sendPoll').onclick = async () => {
  const pollScreen = document.getElementById('screen-poll');
  if (!pollScreen || pollScreen.style.display !== 'block') return;

  if (SENDING_POLL) return;
  SENDING_POLL = true;
  const btn = document.getElementById('sendPoll');
  btn.disabled = true;

  const selected = [...pollForm.querySelectorAll('.pill.selected')].map(b => b.dataset.topic);
  const other = document.getElementById('pollOther').value.trim();

  if (!selected.length && !other) {
    showModal('Выберите хотя бы одну тему или укажите свою.');
    btn.disabled = false; SENDING_POLL = false;
    return;
  }

  const hide = showSpinner('Отправляем голос…');

  const uniq = [...new Set(selected)];
  const batch = uniq.map(t => ({ type:'poll', poll:'webinar_topic', topic:t, other:'' }));
  if (other) batch.push({ type:'poll', poll:'webinar_topic', topic:'Другая тема', other });

  // Отправляем без строгих проверок ответа
  for (const p of batch) { await sendToHook(p); }

  hide();

  // Оптимистично обновим и форс-рефреш
  bumpSummary(uniq, other);
  refreshSummaryNow();
  showModal('Голос учтён! Спасибо 🙌', () => { show('screen-start'); });

  btn.disabled = false;
  SENDING_POLL = false;
};
