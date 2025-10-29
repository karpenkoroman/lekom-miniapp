// ==== НАСТРОЙКИ =============================================================
const HOOK = window.LEKOM_HOOK; // берём из index.html
// ===========================================================================

// КЭШ DOM
const scrStart = document.getElementById('screen-start');
const scrAudit = document.getElementById('screen-audit');
const scrPoll  = document.getElementById('screen-poll');

const btnGoAudit = document.getElementById('goAudit');
const btnGoPoll  = document.getElementById('goPoll');

const backFromAudit = document.getElementById('backFromAudit');
const backFromPoll  = document.getElementById('backFromPoll');

// Вспомогалки
const show = (el) => { if (el) el.style.display = 'block'; };
const hide = (el) => { if (el) el.style.display = 'none'; };
function showScreen(name){
  hide(scrStart); hide(scrAudit); hide(scrPoll);
  if (name === 'start'){ show(scrStart); loadSummaryToStart(); }
  if (name === 'audit'){ show(scrAudit); updateAuditProgress(); }
  if (name === 'poll'){  show(scrPoll);  loadPollSummary();  }
  window.scrollTo({top:0, behavior:'instant'});
}

// ==== ГОЛОСОВАНИЕ ПО ТЕМАМ =================================================

// мультивыбор тем
document.querySelectorAll('.poll-opt').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    btn.classList.toggle('selected');
    const isOther = btn.dataset.topic === 'Другая тема';
    document.getElementById('pollOtherBox').style.display =
      (isOther && btn.classList.contains('selected')) ? 'block' : 'none';
  });
});

// отправка голосов (каждую выбранную тему шлём отдельной записью)
document.getElementById('sendPoll')?.addEventListener('click', async ()=>{
  const selected = [...document.querySelectorAll('.poll-opt.selected')].map(x=>x.dataset.topic);
  if (!selected.length){ toast('Выберите тему'); return; }

  const otherSelected = selected.includes('Другая тема');
  const otherText = otherSelected ? (document.getElementById('pollOther').value || '').trim() : '';

  try{
    // отправляем последовательно, чтобы не дублировало
    for (const topic of selected){
      const payload = {
        type: 'poll',
        poll: 'webinar_topic',
        topic,
        other: topic === 'Другая тема' ? otherText : ''
      };
      await fetch(HOOK + '?q=' + encodeURIComponent(JSON.stringify(payload)));
    }
    toast('Голос учтён! Спасибо 🙌');
    await loadPollSummary();
    // очищаем выбор
    document.querySelectorAll('.poll-opt.selected').forEach(x=>x.classList.remove('selected'));
    document.getElementById('pollOtherBox').style.display = 'none';
    document.getElementById('pollOther').value = '';
  }catch(err){
    toast('Не удалось отправить голос. Попробуйте ещё раз.');
  }
});

// загрузка сводки (для экрана Poll)
async function loadPollSummary(){
  const box = document.getElementById('pollSummary');
  if (!box) return;
  box.textContent = 'Загрузка…';
  try{
    // Скрипт возвращает JSON: { total, items:[{topic,count},...] }
    const res = await fetch(HOOK + '?summary=webinar');
    const data = await res.json();

    box.innerHTML = '';
    const total = data.total || 0;
    const head = document.createElement('div');
    head.className = 'muted';
    head.textContent = `Всего голосов: ${total}`;
    box.appendChild(head);

    (data.items || []).forEach(it=>{
      const row = document.createElement('div');
      row.className = 'summary-row';
      const pct = total ? Math.round((it.count/total)*100) : 0;
      row.innerHTML = `
        <div class="summary-head">
          <div>${it.topic}</div>
          <div class="muted">${it.count} (${pct}%)</div>
        </div>
        <div class="summary-bar"><div class="summary-fill" style="width:${pct}%"></div></div>
      `;
      box.appendChild(row);
    });
    if (!data.items?.length){
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'Пока нет голосов.';
      box.appendChild(empty);
    }
  }catch(e){
    box.innerHTML = '<span class="muted">Не удалось загрузить сводку.</span>';
  }
}

// сводка на стартовом экране
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
    (data.items || []).slice(0,5).forEach(it=>{
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
    box.innerHTML = '';
    box.appendChild(wrap);
  }catch(e){
    box.innerHTML = '<span class="muted">Не удалось загрузить сводку.</span>';
  }
}

// ==== АУДИТ (прогресс/итоги) ===============================================
// подсчитываем выбранные ответы
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
document.querySelectorAll('#auditForm .pill').forEach(p=>{
  p.addEventListener('click', ()=>{
    // одиночный выбор в вопросе
    const q = p.dataset.q;
    document.querySelectorAll(`#auditForm .pill[data-q="${q}"]`).forEach(x=>x.classList.remove('selected'));
    p.classList.add('selected');
    updateAuditProgress();
  });
});

// расчёт и отправка результатов аудита
document.getElementById('btnAuditResult')?.addEventListener('click', async ()=>{
  const answers = getAuditAnswers();
  const total = 11;
  const score = Object.values(answers).reduce((s,a)=>s+(a.score||0),0);

  // красивый заголовок: "N балл/балла/баллов из 11"
  const word = (n=>{
    if (n%100>=11 && n%100<=14) return 'баллов';
    const m = n%10;
    if (m===1) return 'балл';
    if (m>=2 && m<=4) return 'балла';
    return 'баллов';
  })(score);
  const resultText = `${score} ${word} из 11`;

  // вердикт
  let verdict = 'Нужен аудит';
  let advice  = 'Требуется пересмотр парка и бюджета.';
  if (score >= 9){ verdict='Зрелая практика'; advice='У вас всё под контролем, продолжайте.'; }
  else if (score >= 6){ verdict='Частичный контроль'; advice='Рекомендуем уточнить бюджет и процессы.'; }

  // показать в UI
  const txt = document.getElementById('resultText');
  txt.innerHTML = resultText;

  try{
    const payload = {
      type: 'result',
      score,
      verdict,
      advice,
      answers: Object.fromEntries(Object.entries(answers).map(([k,v])=>[k,v.text]))
    };
    await fetch(HOOK + '?q=' + encodeURIComponent(JSON.stringify(payload)));
  }catch(e){
    // не мешаем UX — просто тихо
  }

  // промотать к блоку результатов (по просьбе — без авто-скролла, оставим на месте)
});

// ==== КНОПКИ НАВИГАЦИИ ======================================================
btnGoAudit?.addEventListener('click', ()=> showScreen('audit'));
btnGoPoll ?.addEventListener('click', ()=> showScreen('poll'));
backFromAudit?.addEventListener('click', ()=> showScreen('start'));
backFromPoll ?.addEventListener('click', ()=> showScreen('start'));

// ==== ТОСТ ================================================================
function toast(text){
  const wrap = document.createElement('div');
  wrap.className = 'toast-overlay';
  wrap.innerHTML = `
    <div class="toast-box">
      <div style="margin-bottom:10px">${text}</div>
      <button class="btn btn-primary" type="button">OK</button>
    </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('button').onclick = ()=> document.body.removeChild(wrap);
  wrap.addEventListener('click', (e)=>{ if (e.target===wrap) document.body.removeChild(wrap); });
}

// ==== СТАРТ ================================================================
showScreen('start');
