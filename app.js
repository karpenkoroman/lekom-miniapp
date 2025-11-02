(()=>{
  'use strict';

  const HOOK = window.LEKOM_HOOK || '';
  const TG   = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
  const TG_USER = TG?.initDataUnsafe?.user || null;

  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  // Screens
  const scrStart = $('#screen-start');
  const scrAudit = $('#screen-audit');
  const scrPoll  = $('#screen-poll');

  // Nav
  const btnGoAudit    = $('#goAudit');
  const btnGoPoll     = $('#goPoll');
  const backFromAudit = $('#backFromAudit');
  const backFromPoll  = $('#backFromPoll');

  // Theme
  const themeToggle = $('#themeToggle');
  const iconMoon    = $('#iconMoon');
  const iconSun     = $('#iconSun');
  const themeLabel  = $('#themeLabel');

  // Start summary
  const summaryBox = $('#summaryContent');

  // Audit widgets
  const auditProgressEl = $('#auditProgress');
  const btnAuditResult  = $('#btnAuditResult');
  const btnAuditSub     = $('#btnAuditSub');
  const resultText      = $('#resultText');
  const resultVerdict   = $('#resultVerdict');
  const resultAdvice    = $('#resultAdvice');

  // Expert & lead
  const btnExpert   = $('#ctaExpert');
  const btnLeadTgl  = $('#toggleLead');
  const leadForm    = $('#leadForm');
  const leadName    = $('#leadName');
  const leadCompany = $('#leadCompany');
  const leadPhone   = $('#leadPhone');
  const btnSendLead = $('#sendLead');

  // Poll
  const pollOptions   = $$('#screen-poll .poll-opt');
  const pollOtherBox  = $('#pollOtherBox');
  const pollOtherText = $('#pollOther');
  const btnSendPoll   = $('#sendPoll');

  // Utils
  function show(el){ if (el){ el.style.display='flex'; el.style.flexDirection='column'; } }
  function hide(el){ if (el){ el.style.display='none'; } }
  function showScreen(name){
    hide(scrStart); hide(scrAudit); hide(scrPoll);
    if (name === 'start'){ show(scrStart); loadSummaryToStart(); }
    if (name === 'audit'){ show(scrAudit); updateAuditProgress(); resetCarouselLayout(); }
    if (name === 'poll'){  show(scrPoll); }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function pluralBall(n){
    if (n%100>=11 && n%100<=14) return 'баллов';
    const m=n%10; if(m===1) return 'балл'; if(m>=2&&m<=4) return 'балла'; return 'баллов';
  }
  function toast(html, ok=true, onOk=null){
    const wrap=document.createElement('div');
    wrap.className='toast-overlay';
    wrap.innerHTML=`<div class="toast-box"><div style="margin-bottom:10px">${html}</div>${ok?'<button class="btn btn-primary" type="button">OK</button>':''}</div>`;
    document.body.appendChild(wrap);
    const b=wrap.querySelector('button');
    if(b){ b.onclick=()=>{document.body.removeChild(wrap); onOk&&onOk();}; } else { wrap.addEventListener('click',()=>document.body.removeChild(wrap)); }
  }

  // Theme
  function applyTheme(theme){
    document.documentElement.classList.toggle('theme-light', theme==='light');
    document.documentElement.setAttribute('data-theme', theme);
    if(themeLabel){
      if(theme==='light'){ iconMoon&&(iconMoon.style.display='none'); iconSun&&(iconSun.style.display=''); themeLabel.textContent='Светлая'; }
      else { iconMoon&&(iconMoon.style.display=''); iconSun&&(iconSun.style.display='none'); themeLabel.textContent='Тёмная'; }
    }
    try{ localStorage.setItem('theme', theme); }catch(_){}
  }
  themeToggle?.addEventListener('click', ()=>{
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(cur==='dark' ? 'light' : 'dark');
  });

  // Summary (sorted)
  async function loadSummaryToStart(){
    if(!summaryBox) return;
    summaryBox.innerHTML='<div class="muted">Загрузка…</div>';
    try{
      const r=await fetch(HOOK+'?summary=webinar',{cache:'no-store'});
      const data=await r.json(); // {total,items:[{topic,count}]}
      const wrap=document.createElement('div');
      const total=data.total||0;
      wrap.innerHTML=`<div class="muted" style="margin-bottom:6px">Всего голосов: ${total}</div>`;
      (data.items||[]).slice().sort((a,b)=>b.count-a.count).forEach(it=>{
        const pct= total? Math.round((it.count/total)*100):0;
        const row=document.createElement('div');
        row.className='summary-row';
        row.innerHTML=`
          <div class="summary-head">
            <div>${it.topic}</div>
            <div class="muted">${it.count} (${pct}%)</div>
          </div>
          <div class="summary-bar"><div class="summary-fill" style="width:${pct}%"></div></div>
        `;
        wrap.appendChild(row);
      });
      if(!(data.items||[]).length){
        const empty=document.createElement('div'); empty.className='muted'; empty.textContent='Пока нет голосов.'; wrap.appendChild(empty);
      }
      summaryBox.innerHTML=''; summaryBox.appendChild(wrap);
    }catch(e){
      summaryBox.innerHTML='<span class="muted">Не удалось загрузить сводку.</span>';
    }
  }

  // Poll (multi)
  pollOptions.forEach(p=>{
    p.addEventListener('click', ()=>{
      p.classList.toggle('selected');
      if(p.dataset.topic==='Другая тема'){
        const on=p.classList.contains('selected');
        if(pollOtherBox) pollOtherBox.style.display= on? 'block':'none';
      }
    });
  });
  btnSendPoll?.addEventListener('click', ()=>{
    const selected = $$('#screen-poll .poll-opt.selected').map(x=>x.dataset.topic);
    if(!selected.length){ toast('Выберите тему'); return; }
    const otherText = selected.includes('Другая тема') ? (pollOtherText?.value||'').trim() : '';
    toast('Голос учтён! Спасибо 🙌');

    const base = {
      type:'poll', poll:'webinar_topic',
      initData: TG_USER ? {user:TG_USER} : null,
      user_id: TG_USER?.id||'', username:TG_USER?.username||'', first_name:TG_USER?.first_name||''
    };
    Promise.allSettled(selected.map(topic=>{
      const payload={...base, topic, other: topic==='Другая тема' ? otherText : ''};
      return fetch(HOOK+'?q='+encodeURIComponent(JSON.stringify(payload)),{method:'GET',cache:'no-store'}).catch(()=>null);
    }));

    $$('#screen-poll .poll-opt.selected').forEach(x=>x.classList.remove('selected'));
    pollOtherText&&(pollOtherText.value=''); pollOtherBox&&(pollOtherBox.style.display='none');
  });

  // ==== AUDIT ====
  const TOTAL_Q = 11;

  function getAuditAnswers(){
    const obj={};
    $$('#screen-audit .pill.selected').forEach(p=>{
      const q=p.dataset.q; const score=Number(p.dataset.score||0);
      obj[q]={text:p.textContent.trim(), score};
    });
    return obj;
  }
  function updateAuditProgress(){
    const answered=Object.keys(getAuditAnswers()).length;
    auditProgressEl&&(auditProgressEl.textContent=`Ответы: ${answered} / ${TOTAL_Q}`);
    btnAuditSub&&(btnAuditSub.textContent=`(ответов ${answered} из ${TOTAL_Q})`);
  }
  // single-select
  $$('#screen-audit .pill').forEach(p=>{
    p.addEventListener('click', ()=>{
      const q=p.dataset.q;
      $$('#screen-audit .pill[data-q="'+q+'"]').forEach(x=>x.classList.remove('selected'));
      p.classList.add('selected');
      updateAuditProgress();
    });
  });

  let lastAuditResult = {score:0, verdict:'', advice:'', answers:{}};

  btnAuditResult?.addEventListener('click', ()=>{
    const answers=getAuditAnswers();
    const score=Object.values(answers).reduce((s,a)=>s+(a.score||0),0);
    let verdict='Нужен аудит', advice='Требуется пересмотр парка и бюджета.';
    if(score>=9){ verdict='Зрелая практика'; advice='У вас всё под контролем, продолжайте.'; }
    else if(score>=6){ verdict='Частичный контроль'; advice='Рекомендуем уточнить бюджет и процессы.'; }

    lastAuditResult={
      score, verdict, advice,
      answers:Object.fromEntries(Object.entries(answers).map(([k,v])=>[k,v.text]))
    };

    resultText&&(resultText.innerHTML=`${score} ${pluralBall(score)} из ${TOTAL_Q}`);
    resultVerdict&&(resultVerdict.textContent=verdict, resultVerdict.style.display='');
    resultAdvice&&(resultAdvice.textContent=advice,   resultAdvice.style.display='');

    const payload={
      type:'result', score, verdict, advice, answers:lastAuditResult.answers,
      initData: TG_USER ? {user:TG_USER} : null,
      user_id: TG_USER?.id||'', username:TG_USER?.username||'', first_name:TG_USER?.first_name||''
    };
    fetch(HOOK+'?q='+encodeURIComponent(JSON.stringify(payload)),{method:'GET',cache:'no-store'}).catch(()=>null);
  });

  // Expert / Lead
  btnExpert?.addEventListener('click', async ()=>{
    const msg=`Добрый день! Хочу обсудить результаты самоаудита печати.\n`+
      `Итог: ${lastAuditResult.score} ${pluralBall(lastAuditResult.score)} из ${TOTAL_Q}\n`+
      `Вердикт: ${lastAuditResult.verdict}\n`+
      `Рекомендация: ${lastAuditResult.advice}`;
    try{ await navigator.clipboard.writeText(msg); }catch(_){}
    toast('Текст сообщения скопирован.<br>Вставьте его в чат с Игорем Челебаевым, коммерческим директором ЛЕКОМ.',
      true, ()=> window.open('https://t.me/chelebaev','_blank'));
  });
  btnLeadTgl?.addEventListener('click', ()=>{
    const shown = leadForm && leadForm.style.display==='block';
    if(leadForm){ leadForm.style.display = shown ? 'none' : 'block'; }
    if(!shown) leadName?.focus();
  });
  btnSendLead?.addEventListener('click', ()=>{
    const name=(leadName?.value||'').trim();
    const company=(leadCompany?.value||'').trim();
    const phone=(leadPhone?.value||'').trim();
    if(!name||!phone){ toast('Укажите имя и контакт (телефон или email).'); return; }
    toast('Спасибо! Мы свяжемся с вами.');

    const payload={
      type:'lead', name, company, phone, result:lastAuditResult,
      consent:true, policyUrl:'https://lekom.ru/politika-konfidencialnosti/',
      initData: TG_USER ? {user:TG_USER} : null,
      user_id: TG_USER?.id||'', username:TG_USER?.username||'', first_name:TG_USER?.first_name||''
    };
    fetch(HOOK+'?q='+encodeURIComponent(JSON.stringify(payload)),{method:'GET',cache:'no-store'}).catch(()=>null);

    leadName&&(leadName.value=''); leadCompany&&(leadCompany.value=''); leadPhone&&(leadPhone.value='');
    leadForm&&(leadForm.style.display='none');
  });

  // ==== SWIPE per-question ====
  const track   = $('#auditTrack');
  const dotsBox = $('#auditDots');
  const btnPrev = $('#auditPrev');
  const btnNext = $('#auditNext');

  const slides = $$('#auditTrack .slide');
  const SLIDES_COUNT = slides.length;
  let current = 0;

  function renderDots(){
    dotsBox.innerHTML='';
    for(let i=0;i<SLIDES_COUNT;i++){
      const d=document.createElement('div');
      d.className='dot'+(i===current?' active':'');
      d.dataset.idx=i;
      d.addEventListener('click',()=>goTo(i));
      dotsBox.appendChild(d);
    }
  }
  function goTo(idx){
    current = Math.max(0, Math.min(SLIDES_COUNT-1, idx));
    const x = -current * track.clientWidth;
    track.style.transform = `translate3d(${x}px,0,0)`;
    $$('#auditDots .dot').forEach((d,i)=> d.classList.toggle('active', i===current));
    window.scrollTo({top:0, behavior:'smooth'});
  }
  function next(){ goTo(current+1); }
  function prev(){ goTo(current-1); }
  function resetCarouselLayout(){ goTo(current); }

  // свайпы
  let startX=0, deltaX=0, touching=false;
  const SWIPE_T=40;
  track.addEventListener('touchstart', e=>{ touching=true; startX=e.touches[0].clientX; deltaX=0; }, {passive:true});
  track.addEventListener('touchmove',  e=>{ if(!touching) return; deltaX=e.touches[0].clientX-startX; }, {passive:true});
  track.addEventListener('touchend',   ()=>{ if(!touching) return;
    if(Math.abs(deltaX)>SWIPE_T){ if(deltaX<0) next(); else prev(); } else { goTo(current); }
    touching=false; deltaX=0;
  });

  btnPrev?.addEventListener('click', prev);
  btnNext?.addEventListener('click', next);
  window.addEventListener('resize', resetCarouselLayout);
  renderDots();

  // Nav
  btnGoAudit?.addEventListener('click', ()=>{ current=0; showScreen('audit'); goTo(0); });
  btnGoPoll ?.addEventListener('click', ()=> showScreen('poll'));
  backFromAudit?.addEventListener('click', ()=> showScreen('start'));
  backFromPoll ?.addEventListener('click', ()=> showScreen('start'));

  // Init
  (function ensureTheme(){ try{ const saved=localStorage.getItem('theme'); if(saved==='light'||saved==='dark') applyTheme(saved); }catch(_){}})();
  showScreen('start');
})();
