// === SETTINGS ===
// Твой опубликованный Web App URL (оканчивается на /exec)
const HOOK = 'https://script.google.com/macros/s/AKfycbyvq_c0Hx2jKQ5PyMpqMuCRiCY_PAaMaocgrCAf1X20fVbIrJlj_mQ3cp-TG0TRNUbw/exec';
const SUMMARY_URL = HOOK + (HOOK.includes('?') ? '&' : '?') + 'summary=webinar&callback=__LEKOM_SUMMARY_CB';

// === Telegram initData (для аудита/лидов)
let tgInit = {};
try {
  if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.ready();
    tgInit = window.Telegram.WebApp.initDataUnsafe || {};
  }
} catch (_) {}
const withTelegramData = o => (o.initData = tgInit, o);

// === DOM-секции и заголовки
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
let lastResult = null; // сохраняем последний расчёт результата (для CTA и лида)
const f = document.getElementById('f');
const flds = f ? [...document.querySelectorAll('fieldset.q')] : [];
const total = flds.length;
const progressText = document.getElementById('progressText');
const sendMsg = document.getElementById('sendMsg');

function answered() {
  return flds.reduce((n, fs) => n + (fs.querySelector('input:checked') ? 1 : 0), 0);
}
function updateProgress() {
  if (progressText) progressText.textContent = `Вопрос ${answered()} из ${total}`;
}
if (f) {
  f.addEventListener('click', e => {
    const lab = e.target.closest('.opt'); if (!lab) return;
    const inp = lab.querySelector('input');
    if (inp && !inp.checked) { inp.checked = true; updateProgress(); }
  }, { passive: true });
  f.addEventListener('change', e => {
    if (e.target.matches('input[type="radio"]')) updateProgress();
  }, { passive: true });
}

// === Надёжная отправка: POST JSON -> sendBeacon -> GET (?p=)
async function send(obj) {
  const json = JSON.stringify(obj);

  // 1) POST JSON
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 1500);
    await fetch(HOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: json,
      mode: 'no-cors',
      keepalive: true,
      cache: 'no-store',
      signal: ctrl.signal
    });
    return;
  } catch (_) {}

  // 2) sendBeacon
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([json], { type: 'text/plain;charset=UTF-8' });
      if (navigator.sendBeacon(HOOK, blob)) return;
    }
  } catch (_) {}

  // 3) GET fallback (?p= base64url)
  try {
    const b64 = btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'');
    const url = HOOK + (HOOK.includes('?') ? '&' : '?') + 'p=' + b64;
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 1200);
    await fetch(url, { method: 'GET', mode: 'no-cors', keepalive: true, cache: 'no-store', signal: ctrl.signal });
  } catch (_) {}
}

// === Спец-отправка для голосования: принудительный GET (?q=) — гарантированно в doGet
function sendPollGET(obj) {
  try {
    const url = HOOK + (HOOK.includes('?') ? '&' : '?') + 'q=' + encodeURIComponent(JSON.stringify(obj));
    const s = document.createElement('script'); // JSONP-подобный вызов, чтобы обойти кэш/CORS/WebView
    s.src = url + '&_=' + Date.now();
    s.async = true;
    document.head.appendChild(s);
  } catch (_) {}
}

// === JSONP-Загрузка сводки по темам
window.__LEKOM_SUMMARY_CB = function (data) {
  const box = document.getElementById('summaryBody');
  if (!box) return;
  const total = data?.total || 0;
  const items = Array.isArray(data?.items) ? data.items : [];
  if (!total) { box.textContent = 'Пока нет голосов.'; return; }
  const lines = items.map(it => {
    const pct = Math.round(it.count * 100 / total);
    return `<div class="mt">
      <div class="grid"><div>${it.topic}</div><div>${it.count} (${pct}%)</div></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
    </div>`;
  }).join('');
  box.innerHTML = `Всего голосов: <b>${total}</b><div class="mt">${lines}</div>`;
};
function loadSummary() {
  const s = document.createElement('script');
  s.src = SUMMARY_URL + '&_=' + Date.now();
  s.async = true;
  document.head.appendChild(s);
}

// === Warm-up + стартовая сводка
window.addEventListener('load', () => {
  try { send({ type: 'trace', stage: 'loaded', t: new Date().toISOString() }); } catch (_) {}
  loadSummary();
});

// === Отправка результата аудита
const submitBtn = document.getElementById('submitBtn');
if (submitBtn) {
  submitBtn.addEventListener('click', async e => {
    e.preventDefault();
    const ans = {}, fs = flds; let s = 0;
    fs.forEach((fld, i) => {
      const c = fld.querySelector('input:checked');
      const v = Number(c ? c.value : 0);
      ans['q' + (i + 1)] = v;
      if (v === 1) s++;
    });
    const verdict = s >= 8 ? 'Зрелая инфраструктура'
                  : s >= 5 ? 'Контроль частичный'
                           : 'Высокая уязвимость';
    const advice  = s >= 8 ? 'Точечный аудит TCO и поддержание уровня.'
                  : s >= 5 ? 'Пересмотр бюджета и KPI (TCO, SLA).'
                           : 'Экспресс-аудит, инвентаризация, быстрые меры экономии.';

    lastResult = { score: s, verdict, advice, answers: ans };

    await send(withTelegramData({ type: 'result', ...lastResult, t: new Date().toISOString() }));

    // тост и показ результата
    if (sendMsg) { sendMsg.style.display = 'block'; sendMsg.textContent = '✅ Результаты отправлены!'; setTimeout(() => sendMsg.style.display = 'none', 3000); }
    document.getElementById('resTitle').textContent = `Ваш результат: ${s}/${total} — ${verdict}`;
    document.getElementById('resText').textContent  = advice;
    const res = document.getElementById('res'); res.style.display = 'block';
    setTimeout(() => res.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);

    // Необязательно: обновим сводку после возврата на старт
    setTimeout(loadSummary, 1000);
  });
}

// === CTA «Обсудить с экспертом»: подставляем счёт и вердикт в сообщение
const ctaExpert = document.getElementById('ctaExpert');
if (ctaExpert) {
  ctaExpert.addEventListener('click', () => {
    if (lastResult) {
      const msg = `Здравствуйте! Хочу обсудить аудит печати.\nСчёт: ${lastResult.score}/${total}\nВердикт: ${lastResult.verdict}`;
      const url = `https://t.me/chelebaev?text=${encodeURIComponent(msg)}`;
      ctaExpert.setAttribute('href', url);
    }
  });
}

// === Форма лида
const ctaContact = document.getElementById('ctaContact');
if (ctaContact) {
  ctaContact.addEventListener('click', e => {
    e.preventDefault();
    const lf = document.getElementById('leadForm');
    lf.style.display = 'block';
    lf.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

const sendLeadBtn = document.getElementById('sendLead');
if (sendLeadBtn) {
  sendLeadBtn.addEventListener('click', async e => {
    e.preventDefault();
    const name    = document.getElementById('name').value.trim();
    const company = document.getElementById('company').value.trim();
    const phone   = document.getElementById('phone').value.trim();
    const comment = document.getElementById('comment').value.trim();

    const leadPayload = {
      type: 'lead',
      name, company, phone, comment,
      consent: true,
      policyUrl: 'https://lekom.ru/politika-konfidencialnosti/',
      result: lastResult || null,
      t: new Date().toISOString()
    };
    await send(withTelegramData(leadPayload));
    document.getElementById('leadMsg').style.display = 'block';
    sendLeadBtn.disabled = true;
  });
}

// === Голосование за тему вебинара (через GAS, общий счёт)
const wbOtherRadio   = document.getElementById('wbOtherRadio');
const wbOtherText    = document.getElementById('wbOtherText');
const webinarOptions = document.getElementById('webinarOptions');

if (webinarOptions) {
  webinarOptions.addEventListener('change', () => {
    const isOther = wbOtherRadio && wbOtherRadio.checked;
    if (wbOtherText) wbOtherText.style.display = isOther ? 'block' : 'none';
  });
}

const sendWebinar = document.getElementById('sendWebinar');
if (sendWebinar) {
  sendWebinar.addEventListener('click', () => {
    const c = document.querySelector('input[name="webinar"]:checked');
    if (!c) { alert('Выберите вариант'); return; }
    const topic = c.value;
    let other = '';
    if (topic === 'Другая тема') {
      other = (wbOtherText?.value || '').trim();
      if (other.length < 3) { alert('Пожалуйста, укажите тему (минимум 3 символа)'); return; }
    }
    // Принудительная отправка через GET ?q= — гарантированный проход в doGet
    const payload = withTelegramData({ type: 'poll', poll: 'webinar_topic', topic, other, t: new Date().toISOString() });
    sendPollGET(payload);

    document.getElementById('webinarMsg').style.display = 'block';
    sendWebinar.disabled = true;

    // обновим сводку после отправки
    setTimeout(loadSummary, 1000);
  });
}

// === Reset & Back
function resetAudit() {
  flds.forEach(fs => {
    const checked = fs.querySelector('input:checked');
    if (checked) checked.checked = false;
  });
  const res = document.getElementById('res'); if (res) res.style.display = 'none';
  const lf  = document.getElementById('leadForm'); if (lf) lf.style.display = 'none';
  ['name','company','phone','comment'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const leadMsg = document.getElementById('leadMsg'); if (leadMsg) leadMsg.style.display = 'none';
  if (sendLeadBtn) sendLeadBtn.disabled = false;
  if (progressText) progressText.textContent = `Вопрос 0 из ${total}`;
  if (sendMsg) sendMsg.style.display = 'none';
  lastResult = null;
}
function resetWebinar() {
  const radios = document.querySelectorAll('input[name="webinar"]');
  radios.forEach(r => r.checked = false);
  if (wbOtherText) { wbOtherText.value = ''; wbOtherText.style.display = 'none'; }
  const webinarMsg = document.getElementById('webinarMsg'); if (webinarMsg) webinarMsg.style.display = 'none';
  if (sendWebinar) sendWebinar.disabled = false;
}
function goHome() {
  resetAudit();
  resetWebinar();
  audit.style.display = 'none';
  webinar.style.display = 'none';
  start.style.display = 'block';
  if (titleEl) titleEl.textContent = 'ЛЕКОМ · Интерактив';
  if (subEl) subEl.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  loadSummary();
}
['backHomeFromAudit','backHomeFromAuditTop','backHomeFromWebinar','backHomeFromWebinarTop']
  .forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = '↩️ Вернуться';
      el.addEventListener('click', e => { e.preventDefault(); goHome(); });
    }
  });
