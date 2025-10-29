(() => {
  'use strict';

  // ========= CONFIG =========
  const HOOK = (window && window.LEKOM_HOOK) || '';

  // ========= SAFE DOM GETTERS =========
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // Screens
  const scrStart = $('#screen-start');
  const scrAudit = $('#screen-audit');
  const scrPoll  = $('#screen-poll');

  // Nav buttons
  const btnGoAudit    = $('#goAudit');
  const btnGoPoll     = $('#goPoll');
  const backFromAudit = $('#backFromAudit');
  const backFromPoll  = $('#backFromPoll');

  // Theme toggle
  const themeToggle = $('#themeToggle');
  const iconMoon    = $('#iconMoon');
  const iconSun     = $('#iconSun');
  const themeLabel  = $('#themeLabel');

  // Summary box (start screen)
  const summaryBox = $('#summaryContent');

  // Audit
  const auditForm       = $('#auditForm');
  const auditProgressEl = $('#auditProgress');
  const btnAuditResult  = $('#btnAuditResult');
  const btnAuditSub     = $('#btnAuditSub');
  const resultBox       = $('#resultBox');
  const resultText      = $('#resultText');
  const resultVerdict   = $('#resultVerdict');
  const resultAdvice    = $('#resultAdvice');

  // CTA in result
  const btnExpert  = $('#ctaExpert');
  const btnLeadTgl = $('#toggleLead');
  const leadForm   = $('#leadForm');
  const leadName   = $('#leadName');
  const leadCompany= $('#leadCompany');
  const leadPhone  = $('#leadPhone');
  const btnSendLead= $('#sendLead');

  // Poll
  const pollOptions   = $$('#screen-poll .poll-opt');
  const pollOtherBox  = $('#pollOtherBox');
  const pollOtherText = $('#pollOther');
  const btnSendPoll   = $('#sendPoll');

  // ========= UTIL =========
  function show(el){ if (el) el.style.display = 'flex'; }
  function hide(el){ if (el) el.style.display = 'none'; }

  function showScreen(name){
    hide(scrStart); hide(scrAudit); hide(scrPoll);
    if (name === 'start'){ show(scrStart); loadSummaryToStart(); }
    if (name === 'audit'){ show(scrAudit); updateAuditProgress(); }
    if (name === 'poll'){  show(scrPoll); }
    // к началу
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function pluralBall(n){
    if (n % 100 >= 11 && n % 100 <= 14) return 'баллов';
    const m = n % 10;
    if (m === 1) return 'балл';
    if (m >= 2 && m <= 4) return 'балла';
    return 'баллов';
  }

  // Тост / модалка-подсказка
  function toast(html, withOk = true, onOk = null){
    const wrap = document.createElement('div');
    wrap.className = 'toast-overlay';
    wrap.innerHTML = `
      <div class="toast-box">
        <div style="margin-bottom:10px">${html}</div>
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

  // ========= THEME =========
  function applyTheme(theme){
    document.documentElement.classList.toggle('theme-light', theme === 'light');
    document.documentElement.setAttribute('data-theme', theme);
    if (themeLabel){
      if (theme === 'light'){
        if (iconMoon) iconMoon.style.display = 'none';
        if (iconSun)  iconSun.style.display  = '';
        themeLabel.textContent = 'Светлая';
      } else {
        if (iconMoon) iconMoon.style.display = '';
        if (iconSun)  iconSun.style.display  = 'none';
        themeLabel.textContent = 'Тёмная';
      }
    }
    try{ localStorage.setItem('theme', theme); }catch(_){}
  }

  themeToggle?.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  });

  // ========= SUMMARY (start) =========
  async function loadSummaryToStart(){
    if (!summaryBox) return;
    summaryBox.innerHTML = '<div class="muted">Загрузка…</div>';
    try{
      const res  = await fetch(HOOK + '?summary=webinar', { cache: 'no-store' });
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
      summaryBox.innerHTML = '';
      summaryBox.appendChild(wrap);
    }catch(e){
      summaryBox.innerHTML = '<span class="muted">Не удалось загрузить сводку.</span>';
    }
  }

  // ========= POLL (multi-select) =========
  pollOptions.forEach(p=>{
    p.addEventListener('click', ()=>{
      p.classList.toggle('selected');
      if (p.dataset.topic === 'Другая тема'){
        const on = p.classList.contains('selected');
        if (pollOtherBox) pollOtherBox.style.display = on ? 'block' : 'none';
      }
    });
  });

  btnSendPoll?.addEventListener('click', async ()=>{
    const selected = $$('#screen-poll .poll-opt.selected').map(x=>x.dataset.topic);
    if (!selected.length){ toast('Выберите тему'); return; }
    const otherText = selected.includes('Другая тема') ? (pollOtherText?.value || '').trim() : '';

    try{
      // шлем каждую выбранную тему
      for (const topic of selected){
        const payload = { type:'poll', poll:'webinar_topic', topic, other: topic==='Другая тема' ? otherText : '' };
        await fetch(HOOK + '?q=' + encodeURIComponent(JSON.stringify(payload)), { method:'GET', cache:'no-store' });
      }
      toast('Голос учтён! Спасибо 🙌');
      // очистка выбора
      $$('#screen-poll .poll-opt.selected').forEach(x=>x.classList.remove('selected'));
      if (pollOtherText) pollOtherText.value = '';
      if (pollOtherBox)  pollOtherBox.style.display = 'none';
      // сводку обновим когда вернётся на старт
    }catch(e){
      toast('Не удалось отправить голос. Попробуйте ещё раз.');
    }
  });

  // ========= AUDIT =========
  const TOTAL_Q = 11;

  function getAuditAnswers(){
    const obj = {};
    $$('#auditForm .pill.selected').forEach(p=>{
      const q = p.dataset.q;
      const score = Number(p.dataset.score || 0);
      obj[q] = { text: p.textContent.trim(), score };
    });
    return obj;
  }

  function updateAuditProgress(){
    const answered = Object.keys(getAuditAnswers()).length;
    if (auditProgressEl) auditProgressEl.textContent = `Ответы: ${answered} / ${TOTAL_Q}`;
    if (btnAuditSub)     btnAuditSub.textContent     = `(ответов ${answered} из ${TOTAL_Q})`;
  }

  // одиночный выбор в рамках одного вопроса
  $$('#auditForm .pill').forEach(p=>{
    p.addEventListener('click', ()=>{
      const q = p.dataset.q;
      $$('#auditForm .pill[data-q="'+q+'"]').forEach(x=>x.classList.remove('selected'));
      p.classList.add('selected');
      updateAuditProgress();
    });
  });

  let lastAuditResult = { score:0, verdict:'', advice:'', answers:{} };

  btnAuditResult?.addEventListener('click', async ()=>{
    const answers = getAuditAnswers();
    const score = Object.values(answers).reduce((s,a)=> s + (a.score || 0), 0);

    // Вердикт и рекомендация
    let verdict = 'Нужен аудит';
    let advice  = 'Требуется пересмотр парка и бюджета.';
    if (score >= 9){ verdict='Зрелая практика';      advice='У вас всё под контролем, продолжайте.'; }
    else if (score >= 6){ verdict='Частичный контроль'; advice='Рекомендуем уточнить бюджет и процессы.'; }

    lastAuditResult = {
      score, verdict, advice,
      answers: Object.fromEntries(Object.entries(answers).map(([k,v])=>[k, v.text]))
    };

    // Показ результата
    if (resultText)   resultText.innerHTML   = `${score} ${pluralBall(score)} из ${TOTAL_Q}`;
    if (resultVerdict){ resultVerdict.textContent = verdict; resultVerdict.style.display=''; }
    if (resultAdvice){  resultAdvice.textContent  = advice;  resultAdvice.style.display=''; }

    // Отправка результата (без всплывающих уведомлений)
    try{
      await fetch(HOOK + '?q=' + encodeURIComponent(JSON.stringify({
        type:'result', score, verdict, advice, answers: lastAuditResult.answers
      })), { method:'GET', cache:'no-store' });
    }catch(_){}
  });

  // ========= EXPERT & LEAD =========
  btnExpert?.addEventListener('click', async ()=>{
    const msg =
      `Добрый день! Хочу обсудить результаты самоаудита печати.\n`+
      `Итог: ${lastAuditResult.score} ${pluralBall(lastAuditResult.score)} из ${TOTAL_Q}\n`+
      `Вердикт: ${lastAuditResult.verdict}\n`+
      `Рекомендация: ${lastAuditResult.advice}`;
    try{ await navigator.clipboard.writeText(msg); }catch(_){}

    toast(
      'Текст сообщения скопирован.<br>Вставьте его в чат с Игорем Челебаевым, коммерческим директором ЛЕКОМ.',
      true,
      ()=> { window.open('https://t.me/chelebaev', '_blank'); }
    );
  });

  btnLeadTgl?.addEventListener('click', ()=>{
    if (!leadForm) return;
    const shown = leadForm.style.display === 'block';
    leadForm.style.display = shown ? 'none' : 'block';
    if (!shown){ leadName?.focus(); }
  });

  btnSendLead?.addEventListener('click', async ()=>{
    const name    = (leadName?.value || '').trim();
    const company = (leadCompany?.value || '').trim();
    const phone   = (leadPhone?.value || '').trim();
    if (!name || !phone){ toast('Укажите имя и контакт (телефон или email).'); return; }

    try{
      await fetch(HOOK + '?q=' + encodeURIComponent(JSON.stringify({
        type:'lead',
        name, company, phone,
        result: lastAuditResult,
        consent: true,
        policyUrl: 'https://lekom.ru/politika-konfidencialnosti/'
      })), { method:'GET', cache:'no-store' });

      toast('Спасибо! Мы свяжемся с вами.');
      if (leadName)    leadName.value = '';
      if (leadCompany) leadCompany.value = '';
      if (leadPhone)   leadPhone.value = '';
      if (leadForm)    leadForm.style.display = 'none';
    }catch(e){
      toast('Не удалось отправить. Попробуйте ещё раз.');
    }
  });

  // ========= NAV =========
  btnGoAudit?.addEventListener('click', ()=> showScreen('audit'));
  btnGoPoll ?.addEventListener('click', ()=> showScreen('poll'));
  backFromAudit?.addEventListener('click', ()=> showScreen('start'));
  backFromPoll ?.addEventListener('click', ()=> showScreen('start'));

  // ========= INIT =========
  // Применяем сохранённую тему ещё раз (на случай, если DOM перерисовали)
  (function ensureTheme(){
    try{
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') applyTheme(saved);
    }catch(_){}
  })();

  // Начальный экран
  showScreen('start');
})();
