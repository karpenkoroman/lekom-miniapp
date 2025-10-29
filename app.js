// ====== Навигация между экранами ======
function show(id){
  document.getElementById('screen-start').style.display = (id==='screen-start')?'block':'none';
  document.getElementById('screen-audit').style.display = (id==='screen-audit')?'block':'none';
  document.getElementById('screen-poll').style.display  = (id==='screen-poll')?'block':'none';
}
document.getElementById('goAudit').onclick = ()=>show('screen-audit');
document.getElementById('goPoll').onclick  = ()=>show('screen-poll');
document.getElementById('backStart1').onclick = ()=>show('screen-start');
document.getElementById('backStart2').onclick = ()=>show('screen-start');

// ====== Базовые утилиты ======
const HOOK = window.LEKOM_HOOK || '';
async function postHook(payload){
  if(!HOOK) return;
  try{
    await fetch(HOOK, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload),
      credentials:'omit',
      mode:'cors',
    });
  }catch(e){ /* молча, чтобы не мешать UX */ }
}

// ——— Надёжная подгрузка сводки голосования
async function getSummaryRobust(){
  if(!HOOK) return null;

  // helper: попытаться распарсить JSON из текста
  const tryParse = (txt)=>{
    try { return JSON.parse(txt); } catch(_) {}
    // иногда GAS отдаёт префиксы, попробуем выдрать {...} массив
    const m = txt.match(/\[.+\]/s);
    if(m){ try { return JSON.parse(m[0]); } catch(_){} }
    return null;
  };

  // 1) Попробуем ?summary=webinar (чистый JSON)
  try{
    let u = new URL(HOOK);
    u.searchParams.set('summary','webinar');
    let res = await fetch(u.toString(), { method:'GET', mode:'cors', credentials:'omit' });
    let txt = await res.text();
    let data = tryParse(txt);
    if (Array.isArray(data)) return data;
  }catch(_){}

  // 2) Попробуем ?summary=webinar&format=json
  try{
    let u = new URL(HOOK);
    u.searchParams.set('summary','webinar'); u.searchParams.set('format','json');
    let res = await fetch(u.toString(), { method:'GET', mode:'cors', credentials:'omit' });
    let txt = await res.text();
    let data = tryParse(txt);
    if (Array.isArray(data)) return data;
  }catch(_){}

  // 3) JSONP: ?summary=webinar&callback=__LEKOM_SUMMARY_CB
  try{
    const cb = '__LEKOM_SUMMARY_CB_' + Math.random().toString(36).slice(2);
    const data = await new Promise((resolve,reject)=>{
      window[cb] = (d)=>resolve(d);
      const s = document.createElement('script');
      const u = new URL(HOOK);
      u.searchParams.set('summary','webinar');
      u.searchParams.set('callback', cb);
      s.src = u.toString();
      s.onerror = ()=>reject(new Error('jsonp-error'));
      document.head.appendChild(s);
      setTimeout(()=>reject(new Error('jsonp-timeout')), 5000);
    });
    if (Array.isArray(data)) return data;
  }catch(_){}

  return null;
}

// Рендер сводки
function renderSummary(data){
  const box = document.getElementById('summaryContent');
  if(!box) return;
  if(!data || !Array.isArray(data) || !data.length){
    box.textContent = 'Нет данных по голосованию пока.';
    return;
  }
  box.innerHTML = '';
  const total = data.reduce((a,x)=>a + (Number(x.count)||0), 0);
  const header = document.createElement('div');
  header.className = 'muted';
  header.innerHTML = `Всего голосов: <b>${total}</b>`;
  box.appendChild(header);

  data.forEach(item=>{
    const count = Number(item.count)||0;
    const pct = total ? Math.round(count*100/total) : 0;
    const row = document.createElement('div');
    row.className='summary-row';
    row.innerHTML = `
      <div class="summary-head">
        <div>${item.label}</div>
        <div class="muted">${count} (${pct}%)</div>
      </div>
      <div class="summary-bar"><div class="summary-fill" style="width:${pct}%;"></div></div>
    `;
    box.appendChild(row);
  });
}

// Мгновенная заглушка + асинхронные ретраи
renderSummary([
  {label:'Импортозамещение', count:0},
  {label:'Закупки 44-ФЗ/223-ФЗ', count:0},
  {label:'Обзор рынка и тренды 2025', count:0},
  {label:'Рынок картриджей', count:0},
]);

(async function refreshSummary(){
  const s1 = await getSummaryRobust();
  if (s1 && s1.length) return renderSummary(s1);
  // ретрай через 2 секунды
  setTimeout(async ()=>{
    const s2 = await getSummaryRobust();
    if (s2 && s2.length) return renderSummary(s2);
    // финальный ретрай через 8 секунд
    setTimeout(async ()=>{
      const s3 = await getSummaryRobust();
      if (s3 && s3.length) return renderSummary(s3);
      // оставим заглушку
    }, 8000);
  }, 2000);
})();
// ====== Аудит печати ======
const auditForm = document.getElementById('auditForm');
const auditProgress = document.getElementById('auditProgress');
const TOTAL_Q = 11;

auditForm.addEventListener('click', (e)=>{
  const b = e.target.closest('.pill');
  if(!b) return;
  // снять выбор в рамках вопроса
  const q = b.dataset.q;
  auditForm.querySelectorAll(`.pill[data-q="${q}"]`).forEach(x=>x.classList.remove('selected'));
  b.classList.add('selected');
  updateAuditProgress();
});
function updateAuditProgress(){
  const answered = new Set([...auditForm.querySelectorAll('.pill.selected')].map(x=>x.dataset.q)).size;
  auditProgress.textContent = `Ответы: ${answered} / ${TOTAL_Q}`;
}
updateAuditProgress();

function calcAudit(){
  let score = 0;
  const answers = {};
  for(let i=1;i<=TOTAL_Q;i++){
    const sel = auditForm.querySelector(`.pill.selected[data-q="q${i}"]`);
    if(sel){
      answers['q'+i] = sel.textContent.trim();
      score += Number(sel.dataset.score||0);
    }else{
      answers['q'+i] = null;
    }
  }
  let verdict, advice;
  if(score >= 9){ verdict='Зрелая инфраструктура'; advice='Можно оптимизировать закупки и мониторинг.'; }
  else if(score >= 5){ verdict='Частичный контроль'; advice='Есть риски — полезен TCO-аудит и политика печати.'; }
  else { verdict='Высокая уязвимость'; advice='Рекомендованы ревизия парка и контроль бюджета.'; }
  return {score, verdict, advice, answers};
}

document.getElementById('btnAuditResult').onclick = async ()=>{
  const res = calcAudit();
  // Показать локально
  const box = document.getElementById('resultText');
  box.innerHTML = `Итоговый счёт: <b>${res.score}/11</b><br>Вердикт: <b>${res.verdict}</b><br><span class="muted">${res.advice}</span>`;
  // Отправить в Google (без всплывающих уведомлений!)
  await postHook({ type:'result', score:res.score, verdict:res.verdict, advice:res.advice, answers:res.answers });
  // Запомним для лида/эксперта
  window.__lastAuditResult = res;
};

// Лид-форма
document.getElementById('toggleLead').onclick = ()=>{
  const form = document.getElementById('leadForm');
  form.style.display = (form.style.display==='none'||!form.style.display) ? 'block':'none';
};
document.getElementById('sendLead').onclick = async ()=>{
  const res = window.__lastAuditResult || null;
  const payload = {
    type:'lead',
    name:    document.getElementById('leadName').value.trim(),
    company: document.getElementById('leadCompany').value.trim(),
    phone:   document.getElementById('leadPhone').value.trim(),
    comment: '',
    result:  res || {}
  };
  await postHook(payload);
  // мини квитанция прямо в блоке результата
  const box = document.getElementById('resultText');
  box.innerHTML = `<b>Спасибо!</b> Контакты отправлены.${res?`<br><span class="muted">Итог сохранён: ${res.score}/11 — ${res.verdict}</span>`:''}`;
  document.getElementById('leadForm').style.display='none';
};

// Обсудить с экспертом — сразу в @chelebaev + копия текста в буфер
document.getElementById('ctaExpert').onclick = async ()=>{
  const r = window.__lastAuditResult;
  const msg = r
    ? `Здравствуйте! Хочу обсудить аудит печати.\nСчёт: ${r.score}/11, вердикт: ${r.verdict}.`
    : `Здравствуйте! Хочу обсудить аудит печати.`;

  // пробуем скопировать текст пользователю (на мобильном пригодится)
  try {
    await navigator.clipboard.writeText(msg);
    showToast('Текст сообщения скопирован. Вставьте его в чат @chelebaev и отправьте.', 3500);
  } catch(_) {
    // молча игнорируем, если не дали доступ
  }

  // прямой переход в чат эксперта
  const direct = 'https://t.me/chelebaev';
  // на iOS/Android Telegram-линк откроется нативно; в десктопе — в веб/клиент
  window.location.href = direct;
};

// ====== Вебинар — мультивыбор тем + отправка ======
const pollForm = document.getElementById('pollForm');
pollForm.addEventListener('click', (e)=>{
  const b = e.target.closest('.pill');
  if(!b) return;
  b.classList.toggle('selected'); // мультивыбор
});

document.getElementById('sendPoll').onclick = async ()=>{
  const selected = [...pollForm.querySelectorAll('.pill.selected')].map(b=>b.dataset.topic);
  const otherVal = document.getElementById('pollOther').value.trim();
  if(selected.length===0 && !otherVal){
    alert('Выберите хотя бы одну тему или укажите свою.');
    return;
  }
  // Если выбрана "Другая тема" — дополним текстом
  const payloads = [];
  if(selected.length){
    selected.forEach(topic=>{
      payloads.push({ type:'poll', poll:'webinar_topic', topic, other:'' });
    });
  }
  if(otherVal){
    payloads.push({ type:'poll', poll:'webinar_topic', topic:'Другая тема', other:otherVal });
  }

  // Отправляем (последовательно, чтобы не перегружать GAS)
  for(const p of payloads){
    await postHook(p);
  }

  alert('Голос учтён: ' + [...selected, otherVal?`«${otherVal}»`:''].filter(Boolean).join(', '));
  // Обновим сводку на старте (если хук поддерживает summary)
  const sum = await getSummary();
  if(sum && Array.isArray(sum) && sum.length){
    renderSummary(sum);
  }
  // вернёмся на старт
  show('screen-start');

  function showToast(text, ms=2500){
  let el = document.getElementById('__lekom_toast');
  if(!el){
    el = document.createElement('div');
    el.id='__lekom_toast';
    el.style.cssText='position:fixed;left:50%;top:14px;transform:translateX(-50%);background:#171b25;border:1px solid #293044;color:#eaf0fa;padding:10px 14px;border-radius:10px;z-index:9999;opacity:0;transition:opacity .15s';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.opacity = '1';
  clearTimeout(el.__t);
  el.__t = setTimeout(()=>{ el.style.opacity='0'; }, ms);
}
};
