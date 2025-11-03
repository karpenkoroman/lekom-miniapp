(() => {
  'use strict';

  const HOOK = (window && window.LEKOM_HOOK) || '';
  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // Экранный роутинг
  const scrStart  = $('#screen-start');
  const scrAudit  = $('#screen-audit');
  const scrResult = $('#screen-result');
  const scrPoll   = $('#screen-poll');
  function showOnly(el){
    [scrStart, scrAudit, scrResult, scrPoll].forEach(x=> x.classList.remove('show'));
    el.classList.add('show');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // Тема
  const themeToggle = $('#themeToggle');
  const iconMoon = $('#iconMoon');
  const iconSun  = $('#iconSun');
  const themeLabel = $('#themeLabel');
  function applyTheme(theme){
    document.documentElement.classList.toggle('theme-light', theme === 'light');
    document.documentElement.setAttribute('data-theme', theme);

    if (themeLabel){
      if (theme === 'light'){
        // Светлая тема активна → показываем ЛУНУ (предлагаем перейти в тёмную)
        if (iconMoon) iconMoon.style.display = '';
        if (iconSun)  iconSun.style.display  = 'none';
        themeLabel.textContent = 'Тёмная';
      } else {
        // Тёмная тема активна → показываем СОЛНЦЕ (предлагаем перейти в светлую)
        if (iconMoon) iconMoon.style.display = 'none';
        if (iconSun)  iconSun.style.display  = '';
        themeLabel.textContent = 'Светлая';
      }
    }
    try { localStorage.setItem('theme', theme); } catch(_){}
  }
  themeToggle?.addEventListener('click', ()=>{
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  });

  // Старт
  const btnGoAudit = $('#goAudit');
  const goAuditTitle = $('#goAuditTitle');
  const goAuditSub   = $('#goAuditSub');
  const btnGoPoll  = $('#goPoll');
  const summaryBox = $('#summaryContent');

  // Аудит
  const qContainer = $('#qContainer');
  const auditProgressEl = $('#auditProgress');
  const btnPrev = $('#btnPrev');
  const btnNext = $('#btnNext');

  // Результат
  const resultText    = $('#resultText');
  const resultVerdict = $('#resultVerdict');
  const resultAdvice  = $('#resultAdvice');
  const btnExpert     = $('#ctaExpert');
  const btnScrollLead = $('#ctaScrollLead');
  const leadName      = $('#leadName');
  const leadCompany   = $('#leadCompany');
  const leadPhone     = $('#leadPhone');
  const btnSendLead   = $('#sendLead');
  const backFromResult= $('#backFromResult');

  // Опрос вебинара
  const pollCard      = $('#pollCard');
  const pollOptions   = $$('#screen-poll .poll-opt');
  const pollOtherBox  = $('#pollOtherBox');
  const pollOtherText = $('#pollOther');
  const sendPoll      = $('#sendPoll');
  const backFromPoll  = $('#backFromPoll');

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
    if (btn){ btn.onclick = ()=>{ document.body.removeChild(wrap); onOk && onOk(); }; }
    else { wrap.addEventListener('click', ()=> document.body.removeChild(wrap)); }
  }

  function pluralBall(n){
    if (n % 100 >= 11 && n % 100 <= 14) return 'баллов';
    const m = n % 10;
    if (m === 1) return 'балл';
    if (m >= 2 && m <= 4) return 'балла';
    return 'баллов';
  }

  function getInitData(){
    try { return (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) || null; }
    catch(_) { return null; }
  }

  /* ===== Вопросы ===== */
  const QUESTIONS = [
    { id:'q1',  text:'Как вы оцениваете прозрачность учета расходов на печать в вашей организации?',
      opts:[
        {t:'Мы ведем точный и полный учет всех расходов, включая капитальные.', s:1},
        {t:'Мы учитываем только расходные материалы (картриджи, бумагу и т.п.).', s:0},
        {t:'Учет ведется частично, по запросу или в разных подразделениях по-разному.', s:0},
        {t:'Точных данных нет, расходы оцениваются «на глаз».', s:0},
      ]},
    { id:'q2',  text:'Включены ли в ваш расчет стоимости печати капитальные затраты (амортизация, обновление парка)?',
      opts:[
        {t:'Да, мы учитываем полную стоимость владения (TCO).', s:1},
        {t:'Частично, только при крупных закупках.', s:0},
        {t:'Нет, считаем только текущие затраты.', s:0},
        {t:'Не знаю / этим занимается другой отдел.', s:0},
      ]},
    { id:'q3',  text:'При планировании бюджета на обновление техники вы опираетесь на:',
      opts:[
        {t:'Актуальные рыночные данные и котировки поставщиков.', s:1},
        {t:'Внутренние шаблоны или цифры прошлых лет.', s:0},
        {t:'Субъективные ожидания («примерно столько, сколько раньше»).', s:0},
        {t:'Не выделяем отдельный бюджет на обновление парка.', s:0},
      ]},
    { id:'q4',  text:'Проверяли ли вы соответствие текущего бюджета реальной стоимости оборудования в последние 12 месяцев?',
      opts:[
        {t:'Да, проводим регулярный пересмотр цен.', s:1},
        {t:'Один раз давно, цены могут быть неактуальны.', s:0},
        {t:'Нет, не пересматривали.', s:0},
        {t:'Не знаю.', s:0},
      ]},
    { id:'q5',  text:'Учтено ли в вашем бюджете требование закупать оборудование из реестра отечественного ПО (ПП №185, ПП №878 и др.)?',
      opts:[
        {t:'Да, бюджет сформирован с учетом реестровых решений.', s:1},
        {t:'Частично, только для критичных закупок.', s:0},
        {t:'Нет, закупаем по остаточному принципу.', s:0},
        {t:'Не применимо (мы не попадаем под эти требования).', s:0},
      ]},
    { id:'q6',  text:'Готов ли ваш бюджет к сценарию, где стоимость принтера увеличивается в 3–5 раз из-за регуляторных требований?',
      opts:[
        {t:'Да, предусмотрен резерв или гибкий бюджет.', s:1},
        {t:'Нет, это стало бы серьезной проблемой.', s:0},
        {t:'Пока не анализировали.', s:0},
        {t:'Не знаю.', s:0},
      ]},
    { id:'q7',  text:'Кто в вашей компании фактически принимает решения по закупке и обслуживанию печатной техники?',
      opts:[
        {t:'IT-директор / руководитель департамента.', s:1},
        {t:'Системный администратор или инженер.', s:0},
        {t:'Закупочный отдел.', s:0},
        {t:'Несколько лиц, без четкой ответственности.', s:0},
      ]},
    { id:'q8',  text:'На чем основаны текущие решения по обслуживанию и эксплуатации печати?',
      opts:[
        {t:'На данных TCO-анализа и объективных метриках.', s:1},
        {t:'На личном опыте исполнителей («всегда так делали»).', s:0},
        {t:'На внешних рекомендациях поставщиков.', s:0},
        {t:'На попытке минимизировать расходы «здесь и сейчас».', s:0},
      ]},
    { id:'q9',  text:'Используете ли совместимые картриджи или заправку картриджей?',
      opts:[
        {t:'Нет, только оригинальные расходники.', s:1},
        {t:'Да, массово.', s:0},
        {t:'Да, но только в отдельных случаях.', s:0},
        {t:'Не знаю / не контролирую этот процесс.', s:0},
      ]},
    { id:'q10', text:'Как вы оцениваете уровень зрелости управления печатью в вашей организации?',
      opts:[
        {t:'Стратегический уровень — есть политика, метрики, аналитика, бюджетирование.', s:1},
        {t:'Тактический уровень — решаем по мере возникновения задач.', s:0},
        {t:'Реактивный уровень — действуем при сбоях и запросах пользователей.', s:0},
        {t:'Нет системы управления, процесс стихийный.', s:0},
      ]},
    { id:'q11', text:'Насколько вы уверены, что ваш бюджет по печати не содержит «слепых зон»?',
      opts:[
        {t:'Полностью уверен.', s:1},
        {t:'Скорее уверен.', s:0},
        {t:'Есть сомнения.', s:0},
        {t:'Бюджет определенно требует пересмотра.', s:0},
      ]},
  ];
  const TOTAL_Q = QUESTIONS.length;

  let curIndex = 0;
  let answers  = {};
  let manualMode = false; // включается после "Назад", но на неотвеченном вопросе «Далее» скрываем
  let auditCompleted = false;
  let lastAuditResult = { score:0, verdict:'', advice:'', answers:{} };

  function updateStartButton(){
    if (!btnGoAudit) return;
    if (auditCompleted){
      // (ты уже это менял — оставляю как есть)
      goAuditTitle && (goAuditTitle.textContent = 'Посмотреть результат самоаудита');
      goAuditSub && (goAuditSub.style.display = 'none');
      btnGoAudit.onclick = () => showOnly(scrResult);
    } else {
      goAuditTitle && (goAuditTitle.textContent = 'Пройдите быстрый аудит печати');
      goAuditSub && (goAuditSub.style.display = '');
      btnGoAudit.onclick = () => {
        curIndex = 0; answers = {}; manualMode = false;
        renderQuestion(); showOnly(scrAudit);
      };
    }
  }

  function updateAuditProgress(){
    const answered = Object.keys(answers).length;
    if (auditProgressEl) auditProgressEl.textContent = `Вопросы: ${answered} из ${TOTAL_Q}`;
  }

// --- БАЗА: подмена карточки без скролла и без движения, с мягким fade ---
function swapCardNoAnim(newEl){
  const cont = qContainer;

  // Снимаем фокус, чтобы :active/:focus не «переезжал» на новую плашку
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }

  // Короткая блокировка кликов, чтобы тап не попал в ту же точку новой карточки
  cont.classList.add('guard');
  setTimeout(()=> cont.classList.remove('guard'), 140);

  // Фиксируем текущую высоту контейнера на время свопа (чтобы не было «подъёма»)
  const startH = cont.offsetHeight;
  if (startH > 0) cont.style.minHeight = startH + 'px';

  // Полная замена содержимого
  cont.innerHTML = '';
  newEl.classList.add('q-card');
  cont.appendChild(newEl);

  // Мягкий «проявляющий» оверлей
  const fade = document.createElement('div');
  fade.className = 'card-fade-overlay';
  cont.appendChild(fade);

  // Плавно гасим оверлей, затем снимаем фиксацию высоты
  requestAnimationFrame(()=>{
    fade.classList.add('fout');             // opacity → 0 (см. CSS .55s ease)
    setTimeout(()=>{
      fade.remove();
      cont.style.minHeight = '';            // возвращаем естественную высоту
    }, 560);                                // чуть больше, чем transition в CSS
  });
}



function renderQuestion(){
  const q = QUESTIONS[curIndex];
  updateAuditProgress();

  // «Назад» только со 2-го экрана
  if (btnPrev) btnPrev.style.visibility = (curIndex === 0) ? 'hidden' : 'visible';

  // Если вопрос НЕотвечен — «Далее» скрыта даже в ручном режиме
  const hasAnswer = !!answers[q.id];
  if (btnNext){
    btnNext.style.display = (manualMode && hasAnswer) ? '' : 'none';
    btnNext.disabled = !hasAnswer;
  }

  // создаём новую карточку
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="q-title">
      <span class="q-count">Вопрос ${curIndex + 1} из ${TOTAL_Q}.<br></span> ${q.text}
    </div>
    <div class="opts"></div>
  `;
  const optsBox = wrap.querySelector('.opts');

  q.opts.forEach(opt=>{
    const d = document.createElement('div');
    d.className = 'pill';
    d.textContent = opt.t;
    if (answers[q.id] && answers[q.id].text === opt.t) d.classList.add('selected');

    d.addEventListener('click', ()=>{
      const wasAnswered = !!answers[q.id];
      answers[q.id] = { text: opt.t, score: opt.s };
      Array.from(optsBox.querySelectorAll('.pill')).forEach(p=>p.classList.remove('selected'));
      d.classList.add('selected');

      if (btnNext){
        btnNext.disabled = false;
        if (manualMode && wasAnswered) btnNext.style.display = '';
      }

      updateAuditProgress();

      // авто-переход (без скроллов и «съезда» экрана)
      const shouldAuto = (!manualMode) || (manualMode && !wasAnswered);
      if (shouldAuto){
        setTimeout(()=>{
          if (curIndex < TOTAL_Q - 1) {
            curIndex++;
            renderQuestion();
          } else {
            showResultScreen();
          }
        }, 140); // короткая пауза, чтобы успел погаснуть :active
      }
    });

    optsBox.appendChild(d);
  });

  // подмена карточки — без scrollIntoView
  swapCardNoAnim(wrap);

  // ВАЖНО: никаких прокруток! Это и создавало «подъём снизу».
  // Ни window.scrollTo({behavior:'smooth'}), ни qContainer.scrollIntoView(...)
}
  
  function calcScore(){
    return Object.values(answers).reduce((s,a)=> s + (a.score || 0), 0);
  }

  async function showResultScreen(){
    if (Object.keys(answers).length !== TOTAL_Q){ toast('Ответьте на все вопросы'); return; }
    const score = calcScore();
    let verdict = 'Нужен аудит';
    let advice  = 'Требуется пересмотр парка и бюджета.';
    if (score >= 9){ verdict='Зрелая практика';     advice='У вас всё под контролем, продолжайте.'; }
    else if (score >= 6){ verdict='Частичный контроль'; advice='Рекомендуем уточнить бюджет и процессы.'; }

    lastAuditResult = {
      score, verdict, advice,
      answers: Object.fromEntries(Object.entries(answers).map(([k,v])=>[k, v.text]))
    };

    if (resultText)    resultText.innerHTML = `${score} ${pluralBall(score)} из ${TOTAL_Q}`;
    if (resultVerdict) { resultVerdict.textContent = verdict;  resultVerdict.style.display=''; }
    if (resultAdvice)  { resultAdvice.textContent  = advice;   resultAdvice.style.display=''; }

    auditCompleted = true;
    updateStartButton();
    showOnly(scrResult);

    try{
      fetch(HOOK + '?q=' + encodeURIComponent(JSON.stringify({
        type:'result', score, verdict, advice, answers: lastAuditResult.answers, initData: getInitData()
      })), { method:'GET', cache:'no-store' });
    }catch(_){}
  }

  // ===== Poll =====
  function bumpForKeyboard(on){
    // нижний отступ карточки, чтобы textarea не пряталась за фикс-футер
    if (pollCard) pollCard.style.paddingBottom = on ? '140px' : '16px';
  }

  pollOptions.forEach(p=>{
    p.addEventListener('click', ()=>{
      p.classList.toggle('selected');
      if (p.dataset.topic === 'Другая тема'){
        const on = p.classList.contains('selected');
        if (pollOtherBox) pollOtherBox.style.display = on ? 'block' : 'none';
        if (on){
          pollOtherText?.focus();
          bumpForKeyboard(true);
          setTimeout(()=> pollOtherText?.scrollIntoView({behavior:'smooth', block:'center'}), 50);
        } else {
          bumpForKeyboard(false);
        }
      }
    });
  });

  pollOtherText?.addEventListener('focus', ()=> bumpForKeyboard(true));
  pollOtherText?.addEventListener('blur',  ()=> bumpForKeyboard(false));

  sendPoll?.addEventListener('click', async ()=>{
    const selected = $$('#screen-poll .poll-opt.selected').map(x=>x.dataset.topic);
    if (!selected.length){ toast('Выберите тему'); return; }
    const otherText = selected.includes('Другая тема') ? (pollOtherText?.value || '').trim() : '';
    toast('Голос учтён! Спасибо 🙌');
    try{
      for (const topic of selected){
        const payload = { type:'poll', poll:'webinar_topic', topic, other: topic==='Другая тема' ? otherText : '', initData: getInitData() };
        fetch(HOOK + '?q=' + encodeURIComponent(JSON.stringify(payload)), { method:'GET', cache:'no-store' });
      }
    }catch(_){}
    $$('#screen-poll .poll-opt.selected').forEach(x=>x.classList.remove('selected'));
    if (pollOtherText) pollOtherText.value = '';
    if (pollOtherBox)  pollOtherBox.style.display = 'none';
    bumpForKeyboard(false);
  });

  // ===== Summary на старте =====
  async function loadSummaryToStart(){
    if (!summaryBox) return;
    summaryBox.innerHTML = '<div class="muted">Загрузка…</div>';
    try{
      const res  = await fetch(HOOK + '?summary=webinar', { cache: 'no-store' });
      const data = await res.json();
      const total = data.total ?? (Array.isArray(data) ? data.reduce((s,x)=>s+(x.count||0),0) : 0);
      const items = (data.items || data || []).slice().sort((a,b)=> (b.count||0) - (a.count||0));

      const wrap = document.createElement('div');
      wrap.innerHTML = `<div class="muted" style="margin-bottom:6px">Всего голосов: ${total||0}</div>`;
      if (!items.length){
        const empty = document.createElement('div'); empty.className='muted'; empty.textContent='Пока нет голосов.'; wrap.appendChild(empty);
      } else {
        items.forEach(it=>{
          const cnt = it.count||0, pct = total ? Math.round((cnt/total)*100) : 0;
          const row = document.createElement('div'); row.className='summary-row';
          row.innerHTML = `
            <div class="summary-head"><div>${it.topic||it.label||'-'}</div><div class="muted">${cnt} (${pct}%)</div></div>
            <div class="summary-bar"><div class="summary-fill" style="width:${pct}%"></div></div>`;
          wrap.appendChild(row);
        });
      }
      summaryBox.innerHTML = ''; summaryBox.appendChild(wrap);
    }catch(e){
      console.error(e);
      summaryBox.innerHTML = '<span class="muted">Не удалось загрузить сводку.</span>';
    }
  }

  // ===== CTA «Обсудить сейчас» / Лиды =====
  btnExpert?.addEventListener('click', async ()=>{
    const msg =
      `Добрый день! Хочу обсудить результаты самоаудита печати.\n`+
      `Итог: ${lastAuditResult.score} ${pluralBall(lastAuditResult.score)} из ${TOTAL_Q}\n`+
      `Вердикт: ${lastAuditResult.verdict}\n`+
      `Рекомендация: ${lastAuditResult.advice}`;
    try{ await navigator.clipboard.writeText(msg); }catch(_){}
    toast('Текст сообщения скопирован.<br>Вставьте в чат с Игорем Челебаевым, коммерческим директором ЛЕКОМ.', true,
      ()=> window.open('https://t.me/chelebaev','_blank'));
  });

  // Скролл к форме
  btnScrollLead?.addEventListener('click', ()=>{
    document.getElementById('leadForm')?.scrollIntoView({ behavior:'smooth', block:'start' });
    leadName?.focus();
  });

  // Активность кнопки «Отправить» только при наличии телефона/email
  function validateLead(){
    const hasContact = (leadPhone?.value || '').trim().length > 0;
    if (btnSendLead) btnSendLead.disabled = !hasContact;
  }
  leadPhone?.addEventListener('input', validateLead);
  validateLead();

  btnSendLead?.addEventListener('click', async ()=>{
    const name    = (leadName?.value || '').trim();
    const company = (leadCompany?.value || '').trim();
    const phone   = (leadPhone?.value || '').trim();
    if (!phone){ return; }

    try{
      await fetch(HOOK + '?q=' + encodeURIComponent(JSON.stringify({
        type:'lead', name, company, phone,
        result: lastAuditResult, consent: true,
        policyUrl: 'https://lekom.ru/politika-konfidencialnosti/',
        initData: getInitData()
      })), { method:'GET', cache:'no-store' });

      toast('Спасибо! Мы свяжемся с вами.<br><br>Подпишитесь на наш Telegram — инсайты про печать, кейсы внедрений и полезные материалы: <a href="https://lekomIT.t.me" target="_blank">@LekomIT</a>');

      if (leadName)    leadName.value='';
      if (leadCompany) leadCompany.value='';
      if (leadPhone)   leadPhone.value='';
      validateLead();
    }catch(_){ toast('Не удалось отправить. Попробуйте ещё раз.'); }
  });

  // ===== Навигация =====
  btnGoPoll ?.addEventListener('click', ()=> showOnly(scrPoll));
  backFromPoll ?.addEventListener('click', ()=> showOnly(scrStart));
  backFromResult?.addEventListener('click', ()=> { updateStartButton(); showOnly(scrStart); });

  // ===== Init =====
  applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');
  loadSummaryToStart();
  updateStartButton(); // инициализируем текст «Пройдите…»
})();
