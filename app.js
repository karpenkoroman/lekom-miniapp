// ================== Глобальные ==================
const HOOK = window.LEKOM_HOOK;

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

// ================== Отправка в хук (надёжная) ==================
async function sendToHook(payload) {
  // Вклеим initData из Telegram Mini App, если доступно
  const init = (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) || null;
  if (init && !payload.initData) payload.initData = init;

  // 1) Пытаемся POST
  try {
    const rp = await fetch(HOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      mode: 'cors',
      credentials: 'omit'
    });
    const txt = await rp.text();
    if (rp.ok && (/-(ok|OK)$/.test(txt) || /^(result|lead|poll)-ok$/i.test(txt))) return true;
  } catch (_) { /* молча */ }

  // 2) Fallback: GET ?q=...
  try {
    const u = new URL(HOOK);
    u.searchParams.set('q', JSON.stringify(payload));
    const rg = await fetch(u.toString(), { method:'GET' });
    const t2 = await rg.text();
    if (rg.ok && (/-(ok|OK)$/.test(t2) || /^(result|lead|poll)-ok$/i.test(t2))) return true;
  } catch (_) { /* молча */ }

  return false;
}

// ================== Сводка опросов ==================
async function getSummaryRobust() {
  if (!HOOK) return null;

  const tryParse = (txt) => {
    try { return JSON.parse(txt); } catch(_){}
    const m = txt.match(/\[.+\]/s);
    if (m) { try { return JSON.parse(m[0]); } catch(_){ } }
    return null;
  };

  // ?summary=webinar
  try {
    const u = new URL(HOOK);
    u.searchParams.set('summary','webinar');
    const r = await fetch(u.toString());
    const t = await r.text();
    const d = tryParse(t);
    if (Array.isArray(d)) return d;
  } catch(_){}

  // ?summary=webinar&format=json
  try {
    const u = new URL(HOOK);
    u.searchParams.set('summary','webinar');
    u.searchParams.set('format','json');
    const r = await fetch(u.toString());
    const t = await r.text();
    const d = tryParse(t);
    if (Array.isArray(d)) return d;
  } catch(_){}

  // JSONP
  try {
    const cb = '__LEKOM_SUMMARY_CB_' + Math.random().toString(36).slice(2);
    const data = await new Promise((resolve,reject)=>{
      window[cb] = (d)=>resolve(d);
      const s = document.createElement('script');
      const u = new URL(HOOK);
      u.searchParams.set('summary','webinar');
      u.searchParams.set('callback',cb);
      s.src = u.toString();
      s.onerror = () => reject(new Error('jsonp-error'));
      document.head.appendChild(s);
      setTimeout(()=>reject(new Error('jsonp-timeout')),5000);
    });
    if (Array.isArray(data)) return data;
  } catch(_){}

  return null;
}

function renderSummary(data) {
  const box = document.getElementById('summaryContent');
  if (!box) return;
  if (!data || !data.length) { box.textContent = 'Нет данных.'; return; }

  box.innerHTML = '';
  const tot = data.reduce((a,x)=>a+(Number(x.count)||0),0);
  box.insertAdjacentHTML('beforeend', `<div class="muted">Всего голосов: <b>${tot}</b></div>`);
  data.forEach(x=>{
    const c = Number(x.count)||0;
    const pct = tot ? Math.round(c*100/tot) : 0;
    box.insertAdjacentHTML('beforeend', `
      <div class="summary-row">
        <div class="summary-head">
          <div>${x.label}</div>
          <div class="muted">${c} (${pct}%)</div>
        </div>
        <div class="summary-bar"><div class="summary-fill" style="width:${pct}%"></div></div>
      </div>
    `);
  });
}

// быстрый placeholder + ретраи
try {
  renderSummary([
    {label:'Обзор рынка и тренды 2025', count:0},
    {label:'Импортозамещение', count:0},
    {label:'Закупки 44-ФЗ/223-ФЗ', count:0},
    {label:'Рынок картриджей', count:0},
  ]);
  (async function refreshSummary(){
    const s1 = await getSummaryRobust(); if (s1 && s1.length) return renderSummary(s1);
    setTimeout(async()=>{ const s2=await getSummaryRobust(); if(s2 && s2.length) renderSummary(s2); }, 2000);
    setTimeout(async()=>{ const s3=await getSummaryRobust(); if(s3 && s3.length) renderSummary(s3); }, 8000);
  })();
} catch(_) { /* не блокируем UI */ }

// ================== Аудит ==================
const auditForm = document.getElementById('auditForm');
const prog = document.getElementById('auditProgress');
const TOTAL_Q = 11;

// выбор ответов-«пилюль»
auditForm.addEventListener('click', (e)=>{
  const b = e.target.closest('.pill'); if(!b) return;
  const q = b.dataset.q;
  auditForm.querySelectorAll(`.pill[data-q="${q}"]`).forEach(x=>x.classList.remove('selected'));
  b.classList.add('selected');

  const answered = new Set([...auditForm.querySelectorAll('.pill.selected')].map(x=>x.dataset.q)).size;
  prog.textContent = `Ответы: ${answered} / ${TOTAL_Q}`;
});

// подсчёт результата
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

// показать результат (тихо отправляем, без алертов)
document.getElementById('btnAuditResult').onclick = async ()=>{
  const res = calcAudit();
  document.getElementById('resultText').innerHTML =
    `Итоговый счёт: <b>${res.score}/11</b><br>Вердикт: <b>${res.verdict}</b><br><span class="muted">${res.advice}</span>`;

  await sendToHook({
    type: 'result',
    score: res.score,
    verdict: res.verdict,
    advice: res.advice,
    answers: res.answers
  });
  window.__lastAuditResult = res; // для «Обсудить с экспертом» и лидов
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

  const ok = await sendToHook(payload);
  if (ok) {
    document.getElementById('leadForm').style.display = 'none';
    document.getElementById('resultText').innerHTML = `<b>Спасибо!</b> Контакты отправлены.`;
  } else {
    showModal('Не удалось отправить контакты. Проверьте подключение и попробуйте ещё раз.');
  }
};

// ================== Обсудить с экспертом ==================
document.getElementById('ctaExpert').onclick = async ()=>{
  const r = window.__lastAuditResult;
  const msg = r
    ? `Здравствуйте! Хочу обсудить аудит печати.\nСчёт: ${r.score}/11, вердикт: ${r.verdict}.`
    : `Здравствуйте! Хочу обсудить аудит печати.`;

  try { await navigator.clipboard.writeText(msg); } catch(_){}

  showModal(
    `Текст скопирован.<br>Нажмите «ОК», откроется диалог с <b>@chelebaev</b>, вставьте сообщение и отправьте.`,
    () => { window.location.href = 'https://t.me/chelebaev'; }
  );
};

// ================== Вебинары (мультивыбор) ==================
const pollForm = document.getElementById('pollForm');
pollForm.addEventListener('click', (e)=>{
  const b = e.target.closest('.pill'); if(!b) return;
  b.classList.toggle('selected');
});

document.getElementById('sendPoll').onclick = async () => {
  const selected = [...pollForm.querySelectorAll('.pill.selected')].map(b => b.dataset.topic);
  const other = document.getElementById('pollOther').value.trim();

  if (!selected.length && !other) {
    showModal('Выберите хотя бы одну тему или укажите свою.');
    return;
  }

  // отправляем выбранные темы пакетно
  let ok = true;
  const batch = [];
  selected.forEach(t => batch.push({ type:'poll', poll:'webinar_topic', topic:t, other:'' }));
  if (other) batch.push({ type:'poll', poll:'webinar_topic', topic:'Другая тема', other });

  for (const p of batch) {
    const sent = await sendToHook(p);
    if (!sent) ok = false;
  }

  if (ok) {
    showModal('Голос учтён! Спасибо 🙌', async () => {
      const sum = await getSummaryRobust();
      if (sum && sum.length) renderSummary(sum);
      show('screen-start');
    });
  } else {
    showModal('Не удалось отправить голос. Проверьте подключение и попробуйте ещё раз.');
  }
};

// ================== Модалка по центру ==================
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
