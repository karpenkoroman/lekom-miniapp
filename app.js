// ==== Конфиг ====
const HOOK = window.LEKOM_HOOK;

// ==== DOM ====
const scrStart = document.getElementById('screen-start');
const scrAudit = document.getElementById('screen-audit');
const scrPoll  = document.getElementById('screen-poll');

const btnGoAudit = document.getElementById('goAudit');
const btnGoPoll  = document.getElementById('goPoll');

const backFromAudit = document.getElementById('backFromAudit');
const backFromPoll  = document.getElementById('backFromPoll');

// Навигация
const show = el => { if (el) el.style.display = 'flex'; }; // экраны — .screen с flex
const hide = el => { if (el) el.style.display = 'none'; };
function showScreen(name){
  hide(scrStart); hide(scrAudit); hide(scrPoll);
  if (name === 'start'){ show(scrStart); loadSummaryToStart(); }
  if (name === 'audit'){ show(scrAudit); updateAuditProgress(); }
  if (name === 'poll'){  show(scrPoll);  /* итоги на старте — здесь не грузим */ }
  window.scrollTo({top:0, behavior:'instant'});
}

// ==== Тема ====
const themeToggle = document.getElementById('themeToggle');
const iconMoon = document.getElementById('iconMoon');
const iconSun  = document.getElementById('iconSun');
const themeLabel = document.getElementById('themeLabel');
function applyTheme(theme){
  document.documentElement.classList.toggle('theme-light', theme === 'light');
  document.documentElement.setAttribute('data-theme', theme);
  if (theme === 'light'){
    iconMoon.style.display = 'none'; iconSun.style.display = '';
    themeLabel.textContent = 'Светлая';
  } else {
    iconMoon.style.display = ''; iconSun.style.display = 'none';
    themeLabel.textContent = 'Тёмная';
  }
  localStorage.setItem('theme', theme);
}
themeToggle?.addEventListener('click', ()=>{
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
});

// ==== Тост ====
function toast(text, withOk = true, onOk = null){
  const wrap = document.createElement('div');
  wrap.className = 'toast-overlay';
  wrap.innerHTML = `
    <div class="toast-box">
      <div style="margin-bottom:10px">${text}</div>
      ${withOk ? '<button class="btn btn-primary" type="button">OK</button>' : ''}
    </div>`;
  document.body.appendChild(wrap);
  const btn = wrap.querySelector('button');
  if (btn){
    btn.onclick = ()=>{ document.body.removeChild(wrap); onOk && onOk(); };
  } else {
    wrap.addEventListener('click', ()=> document.body.removeChild(wrap));
  }
}

// ==== Сводка на старте ====
async function loadSummaryToStart(){
  const box = document.getElementById('summaryContent');
  if (!box) return;
  box.innerHTML = '<div class="muted">Загрузка…</div>';
  try{
    const res = await fetch(HOOK + '?summary=webinar');
    const data = await res.json();
    const wrap = document.createElement('div');
    const total = data.total || 0;
    wrap.innerHTML = `<div class="muted" style="margin-bottom:6px">Всего голосов: ${total}</div>`;
    (data.items || []).forEach(it=>{
      const pct = total ? Math.round((it.count/total)*100) : 0;
      const row = document.createElement('div');
      row.className = 'summary-row';
      row.innerHTML = `
        <div class="summary-head">
          <div>${it.topic}</div>
          <div class="muted">${it.count} (${pct}%)</div>
        </div>
        <div class="summary-bar"><div class="summary-fill" style="width:${pct}%"></div></div>
      `;
      wrap.appendChild(row);
    });
    if (!(data.items || []).length){
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'Пока нет голосов.';
      wrap.appendChild(empty);
    }
    box.innerHTML = '';
    box.appendChild(wrap);
  }catch(e){
    box.innerHTML = '<span class="muted">Не удалось загрузить сводку.</span>';
  }
}

// ==== Вебинар: мультивыбор, «Другая тема» ====
document.querySelectorAll('.poll-opt').forEach(p=>{
  p.addEventListener('click', ()=>{
    p.classList.toggle('selected');
    const isOther = p.dataset.topic === 'Другая тема';
    document.getElementById('pollOtherBox').style.display =
      (isOther && p.classList.contains('selected')) ? 'block' : 'none';
  });
});

document.getElementById('sendPoll')?.addEventListener('click', async ()=>{
  const selected = [...document.querySelectorAll('.poll-opt.selected')].map(x=>x.dataset.topic);
  if (!selected.length){ toast('Выберите тему'); return; }
  const otherText = selected.includes('Другая тема') ? (document.getElementById('pollOther').value || '').trim() : '';

  try{
    for (const topic of selected){
      const payload = { type:'poll', poll:'webinar_topic', topic, other: topic==='Другая тема' ? otherText : '' };
      await fetch(HOOK + '?q=' + encodeURIComponent(JSON.stringify(payload)));
    }
    toast('Голос учтён! Спасибо 🙌');
    // очистим выбор
    document.querySelectorAll('.poll-opt.selected').forEach(x=>x.classList.remove('selected'));
    document.getElementById('pollOther').value = '';
    document.getElementById('pollOtherBox').style.display = 'none';
    // обновим сводку на старте (пользователь увидит, вернувшись)
    // loadSummaryToStart(); // можно не дергать сейчас
  }catch(e){
    toast('Не удалось отправить голос. Попробуйте ещё раз.');
  }
});

// ==== Аудит ====
function getAuditAnswers(){
  const obj = {};
  document.querySelectorAll('#auditForm .pill.selected').forEach(p=>{
    const q = p.dataset.q;
    const score = Number(p.dataset.score || 0);
    obj[q] = { text: p.textContent.trim(), score };
  });
  return obj;
}
function updateAuditProgress(){
  const total = 11;
  const answered = Object.keys(getAuditAnswers()).length;
  document.getElementById('auditProgress').textContent = `Ответы: ${answered} / ${total}`;
  const sub = document.getElementById('btnAuditSub');
  if (sub) sub.textContent = `(ответов ${answered} из 11)`;
}
// одиночный выбор в каждом вопросе
document.querySelectorAll('#auditForm .pill').forEach(p=>{
  p.addEventListener('click', ()=>{
    const q = p.dataset.q;
    document.querySelectorAll(`#auditForm .pill[data-q="${q}"]`).forEach(x=>x.classList.remove('selected'));
    p.classList.add('selected');
    updateAuditProgress();
  });
});

function pluralBall(n){
  if (n%100>=11 && n%100<=14) return 'баллов';
  const m = n%10;
  if (m===1) return 'балл';
  if (m>=2 && m<=4) return 'балла';
  return 'баллов';
}

let lastAuditResult = { score:0, verdict:'', advice:'', answers:{} };

document.getElementById('btnAuditResult')?.addEventListener('click', async ()=>{
  const answers = getAuditAnswers();
  const total = 11;
  const score = Object.values(answers).reduce((s,a)=>s+(a.score||0),0);

  let verdict = 'Нужен аудит';
  let advice  = 'Требуется пересмотр парка и бюджета.';
  if (score >= 9){ verdict='Зрелая практика'; advice='У вас всё под контролем, продолжайте.'; }
  else if (score >= 6){ verdict='Частичный контроль'; advice='Рекомендуем уточнить бюджет и процессы.'; }

  lastAuditResult = {
    score, verdict, advice,
    answers: Object.fromEntries(Object.entries(answers).map(([k,v])=>[k,v.text]))
  };

  // Показ в UI
  document.getElementById('resultText').innerHTML = `${score} ${pluralBall(score)} из 11`;
  const v = document.getElementById('resultVerdict');
  const a = document.getElementById('resultAdvice');
  v.textContent = verdict; v.style.display = '';
  a.textContent = advice;  a.style.display = '';

  // Отправка результата
  try{
    await fetch(HOOK + '?q=' + encodeURIComponent(JSON.stringify({
      type:'result',
      score, verdict, advice,
      answers: lastAuditResult.answers
    })));
  }catch(e){ /* тихо */ }
});

// ==== Эксперт и лид ====
document.getElementById('ctaExpert')?.addEventListener('click', async ()=>{
  const msg =
    `Добрый день! Хочу обсудить результаты самоаудита печати.\n`+
    `Итог: ${lastAuditResult.score} ${pluralBall(lastAuditResult.score)} из 11\n`+
    `Вердикт: ${lastAuditResult.verdict}\n`+
    `Рекомендация: ${lastAuditResult.advice}`;
  try{ await navigator.clipboard.writeText(msg); }catch(_){}
  toast('Текст сообщения скопирован.<br>Вставьте его в чат с Игорем Челебаевым, коммерческим директором ЛЕКОМ.', true, ()=>{
    // Открываем чат после OK
    window.open('https://t.me/chelebaev', '_blank');
  });
});

document.getElementById('toggleLead')?.addEventListener('click', ()=>{
  const box = document.getElementById('leadForm');
  box.style.display = (box.style.display === 'none' || box.style.display === '') ? 'block' : 'none';
});

document.getElementById('sendLead')?.addEventListener('click', async ()=>{
  const name = document.getElementById('leadName').value.trim();
  const company = document.getElementById('leadCompany').value.trim();
  const phone = document.getElementById('leadPhone').value.trim();
  if (!name || !phone){ toast('Укажите имя и контакт.'); return; }

  try{
    await fetch(HOOK + '?q=' + encodeURIComponent(JSON.stringify({
      type:'lead',
      name, company, phone,
      result: lastAuditResult,
      consent:true,
      policyUrl:'https://lekom.ru/politika-konfidencialnosti/'
    })));
    toast('Спасибо! Мы свяжемся с вами.');
    // очистка
    document.getElementById('leadName').value = '';
    document.getElementById('leadCompany').value = '';
    document.getElementById('leadPhone').value = '';
    document.getElementById('leadForm').style.display = 'none';
  }catch(e){
    toast('Не удалось отправить. Попробуйте ещё раз.');
  }
});

// ==== Навигация ====
btnGoAudit?.addEventListener('click', ()=> showScreen('audit'));
btnGoPoll ?.addEventListener('click', ()=> showScreen('poll'));
backFromAudit?.addEventListener('click', ()=> showScreen('start'));
backFromPoll ?.addEventListener('click', ()=> showScreen('start'));

// ==== Старт ====
showScreen('start');
