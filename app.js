(()=>{'use strict';

const HOOK = window.LEKOM_HOOK || '';
const TOTAL_Q = 11;

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

/* Экраны */
const scrStart  = $('#screen-start');
const scrAudit  = $('#screen-audit');
const scrResult = $('#screen-result');
const scrPoll   = $('#screen-poll');

/* Навигация */
const btnGoAudit        = $('#goAudit');
const btnGoPoll         = $('#goPoll');
const backFromAudit     = $('#backFromAudit');
const backFromResult    = $('#backFromResult');
const backFromPoll      = $('#backFromPoll');
const resumeCtaWrap     = $('#resumeCta');
const showResultFromStart = $('#showResultFromStart');

/* Тема */
const themeToggle = $('#themeToggle');
const iconMoon = $('#iconMoon');
const iconSun  = $('#iconSun');
const themeLabel = $('#themeLabel');

/* Сводка на старте */
const summaryBox = $('#summaryContent');

/* Аудит */
const qcardsWrap      = $('#qcards');
const auditProgressEl = $('#auditProgress');

/* Результаты */
const resultText    = $('#resultText');
const resultVerdict = $('#resultVerdict');
const resultAdvice  = $('#resultAdvice');
const btnExpert     = $('#ctaExpert');
const btnLeadTgl    = $('#toggleLead');
const leadForm      = $('#leadForm');
const leadName      = $('#leadName');
const leadCompany   = $('#leadCompany');
const leadPhone     = $('#leadPhone');
const btnSendLead   = $('#sendLead');

/* Опрос вебинара */
const pollOptionEls  = $$('#screen-poll .poll-opt');
const pollOtherBox   = $('#pollOtherBox');
const pollOtherText  = $('#pollOther');
const btnSendPoll    = $('#sendPoll');

function getInitData(){ try{ return window.Telegram?.WebApp?.initDataUnsafe || null; }catch(_){ return null; } }

/* Утилиты */
function show(el){ if(el) el.style.display='flex'; }
function hide(el){ if(el) el.style.display='none'; }
function showOnly(el){
  [scrStart,scrAudit,scrResult,scrPoll].forEach(x=>hide(x));
  show(el);
  window.scrollTo({top:0,behavior:'instant'});
}

function pluralBall(n){
  if (n % 100 >= 11 && n % 100 <= 14) return 'баллов';
  const m = n % 10;
  if (m === 1) return 'балл';
  if (m >= 2 && m <= 4) return 'балла';
  return 'баллов';
}

function toast(html, withOk = true, onOk = null){
  const wrap = document.createElement('div');
  wrap.className = 'toast-overlay';
  wrap.innerHTML = `<div class="toast-box"><div style="margin-bottom:10px">${html}</div>${withOk?'<button class="btn btn-primary" type="button">OK</button>':''}</div>`;
  document.body.appendChild(wrap);
  const btn = wrap.querySelector('button');
  if (btn) btn.onclick = ()=>{ document.body.removeChild(wrap); onOk && onOk(); };
  else wrap.onclick = ()=> document.body.removeChild(wrap);
}

/* Тема */
function applyTheme(theme){
  document.documentElement.classList.toggle('theme-light', theme === 'light');
  document.documentElement.setAttribute('data-theme', theme);
  if (themeLabel){
    if (theme === 'light'){ iconMoon.style.display='none'; iconSun.style.display=''; themeLabel.textContent='Светлая'; }
    else { iconMoon.style.display=''; iconSun.style.display='none'; themeLabel.textContent='Тёмная'; }
  }
  try{ localStorage.setItem('theme', theme); }catch(_){}
}
themeToggle?.addEventListener('click', ()=>{
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
});
(()=>{ const s=localStorage.getItem('theme'); if (s==='light'||s==='dark') applyTheme(s); })();

/* Вопросы */
const QUESTIONS = [
  { id:'q1', text:'Как вы оцениваете прозрачность учета расходов на печать в вашей организации?', options:[
    {t:'Мы ведем точный и полный учет всех расходов, включая капитальные.', s:1},
    {t:'Мы учитываем только расходные материалы (картриджи, бумагу и т.п.).', s:0},
    {t:'Учет ведется частично, по запросу или в разных подразделениях по-разному.', s:0},
    {t:'Точных данных нет, расходы оцениваются «на глаз».', s:0},
  ]},
  { id:'q2', text:'Включены ли в ваш расчет стоимости печати капитальные затраты (амортизация, обновление парка)?', options:[
    {t:'Да, мы учитываем полную стоимость владения (TCO).', s:1},
    {t:'Частично, только при крупных закупках.', s:0},
    {t:'Нет, считаем только текущие затраты.', s:0},
    {t:'Не знаю / этим занимается другой отдел.', s:0},
  ]},
  { id:'q3', text:'При планировании бюджета на обновление техники вы опираетесь на:', options:[
    {t:'Актуальные рыночные данные и котировки поставщиков.', s:1},
    {t:'Внутренние шаблоны или цифры прошлых лет.', s:0},
    {t:'Субъективные ожидания («примерно столько, сколько раньше»).', s:0},
    {t:'Не выделяем отдельный бюджет на обновление парка.', s:0},
  ]},
  { id:'q4', text:'Проверяли ли вы соответствие текущего бюджета реальной стоимости оборудования в последние 12 месяцев?', options:[
    {t:'Да, проводим регулярный пересмотр цен.', s:1},
    {t:'Один раз давно, цены могут быть неактуальны.', s:0},
    {t:'Нет, не пересматривали.', s:0},
    {t:'Не знаю.', s:0},
  ]},
  { id:'q5', text:'Учтено ли в вашем бюджете требование закупать оборудование из реестра отечественного ПО (ПП №185, ПП №878 и др.)?', options:[
    {t:'Да, бюджет сформирован с учетом реестровых решений.', s:1},
    {t:'Частично, только для критичных закупок.', s:0},
    {t:'Нет, закупаем по остаточному принципу.', s:0},
    {t:'Не применимо (мы не попадаем под эти требования).', s:0},
  ]},
  { id:'q6', text:'Готов ли ваш бюджет к сценарию, где стоимость принтера увеличивается в 3–5 раз из-за регуляторных требований?', options:[
    {t:'Да, предусмотрен резерв или гибкий бюджет.', s:1},
    {t:'Нет, это стало бы серьезной проблемой.', s:0},
    {t:'Пока не анализировали.', s:0},
    {t:'Не знаю.', s:0},
  ]},
  { id:'q7', text:'Кто в вашей компании фактически принимает решения по закупке и обслуживанию печатной техники?', options:[
    {t:'IT-директор / руководитель департамента.', s:1},
    {t:'Системный администратор или инженер.', s:0},
    {t:'Закупочный отдел.', s:0},
    {t:'Несколько лиц, без четкой ответственности.', s:0},
  ]},
  { id:'q8', text:'На чем основаны текущие решения по обслуживанию и эксплуатации печати?', options:[
    {t:'На данных TCO-анализа и объективных метриках.', s:1},
    {t:'На личном опыте исполнителей («всегда так делали»).', s:0},
    {t:'На внешних рекомендациях поставщиков.', s:0},
    {t:'На попытке минимизировать расходы «здесь и сейчас».', s:0},
  ]},
  { id:'q9', text:'Используете ли совместимые картриджи или заправку картриджей?', options:[
    {t:'Нет, только оригинальные расходники.', s:1},
    {t:'Да, массово.', s:0},
    {t:'Да, но только в отдельных случаях.', s:0},
    {t:'Не знаю / не контролирую этот процесс.', s:0},
  ]},
  { id:'q10', text:'Как вы оцениваете уровень зрелости управления печатью в вашей организации?', options:[
    {t:'Стратегический уровень — есть политика, метрики, аналитика, бюджетирование.', s:1},
    {t:'Тактический уровень — решаем по мере возникновения задач.', s:0},
    {t:'Реактивный уровень — действуем при сбоях и запросах пользователей.', s:0},
    {t:'Нет системы управления, процесс стихийный.', s:0},
  ]},
  { id:'q11', text:'Насколько вы уверены, что ваш бюджет по печати не содержит «слепых зон»?', options:[
    {t:'Полностью уверен.', s:1},
    {t:'Скорее уверен.', s:0},
    {t:'Есть сомнения.', s:0},
    {t:'Бюджет определенно требует пересмотра.', s:0},
  ]},
];

const answers = {};
let currentIndex = 0;
let lastAuditResult = { score:0, verdict:'', advice:'', answers:{} };
let auditCompleted = false;

/* Рендер карточек */
function renderCards(){
  if (!qcardsWrap) return;
  qcardsWrap.innerHTML = '';
  QUESTIONS.forEach((q, idx)=>{
    const card = document.createElement('div');
    card.className = 'qcard';
    card.dataset.idx = idx;

    const t = document.createElement('div');
    t.className = 'qtext';
    t.textContent = `${idx+1}. ${q.text}`;
    card.appendChild(t);

    const opts = document.createElement('div');
    q.options.forEach(opt=>{
      const pill = document.createElement('div');
      pill.className = 'pill';
      pill.textContent = opt.t;
      if (answers[q.id]?.text === opt.t) pill.classList.add('selected');

      pill.onclick = ()=>{
        opts.querySelectorAll('.pill').forEach(x=>x.classList.remove('selected'));
        pill.classList.add('selected');
        answers[q.id] = { text: opt.t, score: opt.s };
        updateAuditProgress();

        setTimeout(()=>{
          if (idx < QUESTIONS.length-1) {
            goToIndex(idx+1);
          } else {
            showResultScreen();
          }
        }, 200);
      };
      opts.appendChild(pill);
    });
    card.appendChild(opts);

    const nav = document.createElement('div');
    nav.className = 'qnav';
    const back = document.createElement('button');
    back.className = 'btn btn-secondary';
    back.textContent = 'Назад';
    if (idx === 0) back.style.display = 'none';
    back.onclick = ()=> goToIndex(idx-1);

    const next = document.createElement('button');
    next.className = 'btn btn-primary';
    next.textContent = (idx === QUESTIONS.length-1) ? 'К результату' : 'Далее';
    next.disabled = !answers[q.id];
    next.onclick = ()=>{
      if (idx < QUESTIONS.length-1) goToIndex(idx+1);
      else showResultScreen();
    };

    nav.append(back, next);
    card.appendChild(nav);

    qcardsWrap.appendChild(card);
  });
  goToIndex(0);
}

function goToIndex(i){
  currentIndex = Math.max(0, Math.min(QUESTIONS.length-1, i));
  qcardsWrap.querySelectorAll('.qcard').forEach((c, idx)=>{
    c.style.display = (idx===currentIndex) ? 'block' : 'none';
    const q = QUESTIONS[idx];
    const nextBtn = c.querySelector('.btn.btn-primary');
    const backBtn = c.querySelector('.btn.btn-secondary');
    if (backBtn) backBtn.style.display = (idx===0) ? 'none' : 'inline-flex';
    if (nextBtn) nextBtn.disabled = !answers[q.id];
  });
  qcardsWrap.querySelector(`.qcard[data-idx="${currentIndex}"]`)?.scrollIntoView({behavior:'smooth', block:'start'});
}

function updateAuditProgress(){
  const answered = Object.keys(answers).length;
  if (auditProgressEl) auditProgressEl.textContent = `Ответы: ${answered} / ${TOTAL_Q}`;
}

/* Результат */
async function showResultScreen(){
  if (Object.keys(answers).length !== QUESTIONS.length){
    toast('Ответьте на все вопросы'); return;
  }
  const score = Object.values(answers).reduce((s,a)=> s + (a.score || 0), 0);
  let verdict='Нужен аудит', advice='Требуется пересмотр парка и бюджета.';
  if (score >= 9){ verdict='Зрелая практика'; advice='У вас всё под контролем, продолжайте.'; }
  else if (score >= 6){ verdict='Частичный контроль'; advice='Рекомендуем уточнить бюджет и процессы.'; }

  lastAuditResult = {
    score, verdict, advice,
    answers: Object.fromEntries(Object.entries(answers).map(([k,v])=>[k, v.text]))
  };

  if (resultText)    resultText.innerHTML    = `${score} ${pluralBall(score)} из ${TOTAL_Q}`;
  if (resultVerdict) { resultVerdict.textContent = verdict; resultVerdict.style.display=''; }
  if (resultAdvice)  { resultAdvice.textContent  = advice;  resultAdvice.style.display=''; }

  auditCompleted = true;
  updateStartResumeCta();     // покажем кнопку на старте
  showOnly(scrResult);

  try{
    await fetch(HOOK + '?q=' + encodeURIComponent(JSON.stringify({
      type:'result', score, verdict, advice,
      answers: lastAuditResult.answers, initData: getInitData()
    })), { method:'GET', cache:'no-store' });
  }catch(_){}
}

/* CTA + лиды */
btnExpert?.addEventListener('click', async ()=>{
  const msg =
    `Добрый день! Хочу обсудить результаты самоаудита печати.\n`+
    `Итог: ${lastAuditResult.score} ${pluralBall(lastAuditResult.score)} из ${TOTAL_Q}\n`+
    `Вердикт: ${lastAuditResult.verdict}\n`+
    `Рекомендация: ${lastAuditResult.advice}`;
  try{ await navigator.clipboard.writeText(msg); }catch(_){}
  toast('Текст сообщения скопирован.<br>Вставьте его в чат с Игорем Челебаевым, коммерческим директором ЛЕКОМ.', true,
    ()=> window.open('https://t.me/chelebaev','_blank'));
});

btnLeadTgl?.addEventListener('click', ()=>{
  const shown = leadForm.style.display === 'block';
  leadForm.style.display = shown ? 'none' : 'block';
  if (!shown) leadName?.focus();
});

btnSendLead?.addEventListener('click', async ()=>{
  const name    = (leadName?.value || '').trim();
  const company = (leadCompany?.value || '').trim();
  const phone   = (leadPhone?.value || '').trim();
  if (!name || !phone){ toast('Укажите имя и контакт (телефон или email).'); return; }

  try{
    await fetch(HOOK + '?q=' + encodeURIComponent(JSON.stringify({
      type:'lead', name, company, phone,
      result: lastAuditResult, consent:true,
      policyUrl:'https://lekom.ru/politika-konfidencialnosti/', initData:getInitData()
    })), { method:'GET', cache:'no-store' });

    toast('Спасибо! Мы свяжемся с вами.');
    leadName.value=''; leadCompany.value=''; leadPhone.value=''; leadForm.style.display='none';
  }catch(_){ toast('Не удалось отправить. Попробуйте ещё раз.'); }
});

/* Сводка на старте (сортировка) */
async function loadSummaryToStart(){
  if (!summaryBox) return;
  summaryBox.innerHTML = '<div class="muted">Загрузка…</div>';
  try{
    const r = await fetch(HOOK+'?summary=webinar', { cache:'no-store' });
    const d = await r.json();
    const wrap = document.createElement('div');
    const total = d.total || 0;
    const items = (d.items || []).slice().sort((a,b)=> b.count - a.count);
    wrap.innerHTML = `<div class="muted" style="margin-bottom:6px">Всего голосов: ${total}</div>`;
    items.forEach(it=>{
      const pct = total ? Math.round(it.count/total*100) : 0;
      wrap.insertAdjacentHTML('beforeend', `
        <div class="summary-row">
          <div class="summary-head">
            <div>${it.topic}</div>
            <div class="muted">${it.count} (${pct}%)</div>
          </div>
          <div class="summary-bar"><div class="summary-fill" style="width:${pct}%"></div></div>
        </div>
      `);
    });
    if (!items.length) wrap.innerHTML += '<div class="muted">Пока нет голосов.</div>';
    summaryBox.innerHTML = ''; summaryBox.appendChild(wrap);
  }catch(_){
    summaryBox.innerHTML = '<span class="muted">Не удалось загрузить сводку.</span>';
  }
}

/* Опрос вебинара */
pollOptionEls.forEach(p=>{
  p.onclick = ()=>{
    p.classList.toggle('selected');
    if (p.dataset.topic === 'Другая тема'){
      pollOtherBox.style.display = p.classList.contains('selected') ? 'block' : 'none';
    }
  };
});

btnSendPoll?.addEventListener('click', async ()=>{
  const selected = $$('#screen-poll .poll-opt.selected').map(x=>x.dataset.topic);
  if (!selected.length){ toast('Выберите тему'); return; }
  const otherText = selected.includes('Другая тема') ? (pollOtherText?.value || '').trim() : '';
  try{
    for (const topic of selected){
      const payload = { type:'poll', poll:'webinar_topic', topic, other: topic==='Другая тема' ? otherText : '', initData: getInitData() };
      await fetch(HOOK + '?q=' + encodeURIComponent(JSON.stringify(payload)), { method:'GET', cache:'no-store' });
    }
    toast('Голос учтён! Спасибо 🙌');
    $$('#screen-poll .poll-opt.selected').forEach(x=>x.classList.remove('selected'));
    if (pollOtherText) pollOtherText.value = '';
    if (pollOtherBox)  pollOtherBox.style.display = 'none';
  }catch(_){
    toast('Не удалось отправить голос. Попробуйте ещё раз.');
  }
});

/* CTA «показать результат» на старте */
function updateStartResumeCta(){
  if (!resumeCtaWrap) return;
  resumeCtaWrap.style.display = auditCompleted ? 'block' : 'none';
}

/* Навигация */
btnGoAudit?.addEventListener('click', ()=> showOnly(scrAudit));
btnGoPoll ?.addEventListener('click', ()=> showOnly(scrPoll));
backFromAudit ?.addEventListener('click', ()=> { updateStartResumeCta(); auditCompleted ? showOnly(scrResult) : showOnly(scrStart); loadSummaryToStart(); });
backFromResult?.addEventListener('click', ()=> { updateStartResumeCta(); auditCompleted ? showOnly(scrResult) : showOnly(scrStart); loadSummaryToStart(); });
backFromPoll  ?.addEventListener('click', ()=> { showOnly(scrStart); loadSummaryToStart(); });
showResultFromStart?.addEventListener('click', ()=> showOnly(scrResult));

/* Старт */
function init(){
  renderCards();
  loadSummaryToStart();
  updateStartResumeCta();
  showOnly(scrStart);
}
init();

})();
