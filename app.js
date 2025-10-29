// ===== Навигация =====
const HOOK = window.LEKOM_HOOK;

function show(id){
  ['screen-start','screen-audit','screen-poll'].forEach(x=>{
    const el=document.getElementById(x);
    if(el) el.style.display=(x===id)?'block':'none';
  });
}
['goAudit','goPoll','backStart1','backStart2'].forEach(id=>{
  const e=document.getElementById(id);
  if(!e) return;
  e.onclick=()=>{
    if(id==='goAudit') show('screen-audit');
    else if(id==='goPoll') show('screen-poll');
    else show('screen-start');
  };
});

// ===== Вспомогалки =====
async function postHook(payload){
  if(!HOOK) return;
  try{
    await fetch(HOOK,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload),
      mode:'cors',
      credentials:'omit'
    });
  }catch(e){/* тихо, чтобы не мешать UX */}
}

async function getSummaryRobust(){
  if(!HOOK) return null;
  const tryParse=(txt)=>{
    try{ return JSON.parse(txt); }catch(_){}
    const m=txt.match(/\[.+\]/s); if(m){ try{ return JSON.parse(m[0]); }catch(_){ } }
    return null;
  };
  // ?summary=webinar
  try{
    const u=new URL(HOOK); u.searchParams.set('summary','webinar');
    const r=await fetch(u.toString()); const t=await r.text(); const d=tryParse(t);
    if(Array.isArray(d)) return d;
  }catch(_){}
  // ?summary=webinar&format=json
  try{
    const u=new URL(HOOK); u.searchParams.set('summary','webinar'); u.searchParams.set('format','json');
    const r=await fetch(u.toString()); const t=await r.text(); const d=tryParse(t);
    if(Array.isArray(d)) return d;
  }catch(_){}
  // JSONP
  try{
    const cb='__LEKOM_SUMMARY_CB_'+Math.random().toString(36).slice(2);
    const data=await new Promise((resolve,reject)=>{
      window[cb]=(d)=>resolve(d);
      const s=document.createElement('script');
      const u=new URL(HOOK); u.searchParams.set('summary','webinar'); u.searchParams.set('callback',cb);
      s.src=u.toString(); s.onerror=()=>reject(new Error('jsonp-error'));
      document.head.appendChild(s);
      setTimeout(()=>reject(new Error('jsonp-timeout')),5000);
    });
    if(Array.isArray(data)) return data;
  }catch(_){}
  return null;
}

function renderSummary(data){
  const box=document.getElementById('summaryContent');
  if(!box) return;
  if(!data || !data.length){ box.textContent='Нет данных.'; return; }
  box.innerHTML='';
  const tot=data.reduce((a,x)=>a+(Number(x.count)||0),0);
  box.insertAdjacentHTML('beforeend',`<div class="muted">Всего голосов: <b>${tot}</b></div>`);
  data.forEach(x=>{
    const c=Number(x.count)||0; const pct=tot?Math.round(c*100/tot):0;
    box.insertAdjacentHTML('beforeend',`
      <div class="summary-row">
        <div class="summary-head"><div>${x.label}</div><div class="muted">${c} (${pct}%)</div></div>
        <div class="summary-bar"><div class="summary-fill" style="width:${pct}%"></div></div>
      </div>
    `);
  });
}

// Мгновенная заглушка + ретраи
renderSummary([
  {label:'Обзор рынка и тренды 2025', count:0},
  {label:'Импортозамещение', count:0},
  {label:'Закупки 44-ФЗ/223-ФЗ', count:0},
  {label:'Рынок картриджей', count:0},
]);
(async function refreshSummary(){
  const s1=await getSummaryRobust(); if(s1 && s1.length) return renderSummary(s1);
  setTimeout(async()=>{ const s2=await getSummaryRobust(); if(s2 && s2.length) return renderSummary(s2); }, 2000);
  setTimeout(async()=>{ const s3=await getSummaryRobust(); if(s3 && s3.length) return renderSummary(s3); }, 8000);
})();

// ===== Аудит =====
const auditForm=document.getElementById('auditForm');
const prog=document.getElementById('auditProgress');
const TOTAL_Q=11;

auditForm.addEventListener('click',e=>{
  const b=e.target.closest('.pill'); if(!b) return;
  const q=b.dataset.q;
  auditForm.querySelectorAll(`.pill[data-q="${q}"]`).forEach(x=>x.classList.remove('selected'));
  b.classList.add('selected');

  const answered=new Set([...auditForm.querySelectorAll('.pill.selected')].map(x=>x.dataset.q)).size;
  prog.textContent=`Ответы: ${answered} / ${TOTAL_Q}`;
});

function calcAudit(){
  let score=0; const answers={};
  for(let i=1;i<=TOTAL_Q;i++){
    const sel=auditForm.querySelector(`.pill.selected[data-q="q${i}"]`);
    if(sel){ answers['q'+i]=sel.textContent.trim(); score+=Number(sel.dataset.score||0); }
    else { answers['q'+i]=null; }
  }
  let verdict, advice;
  if(score>=9){ verdict='Зрелая инфраструктура'; advice='Можно оптимизировать закупки и мониторинг.'; }
  else if(score>=5){ verdict='Частичный контроль'; advice='Рекомендуем TCO-аудит и политику печати.'; }
  else { verdict='Нужен аудит'; advice='Нужен пересмотр парка и бюджета.'; }
  return {score, verdict, advice, answers};
}

document.getElementById('btnAuditResult').onclick=async()=>{
  const res=calcAudit();
  document.getElementById('resultText').innerHTML=
    `Итоговый счёт: <b>${res.score}/11</b><br>Вердикт: <b>${res.verdict}</b><br><span class="muted">${res.advice}</span>`;
  await postHook({type:'result',score:res.score,verdict:res.verdict,advice:res.advice,answers:res.answers});
  window.__lastAuditResult=res;
};

// Оставить контакты — раскрыть и прокрутить вниз
document.getElementById('toggleLead').onclick=()=>{
  const f=document.getElementById('leadForm');
  f.style.display='block';
  f.scrollIntoView({behavior:'smooth',block:'start'});
};

document.getElementById('sendLead').onclick=async()=>{
  const res=window.__lastAuditResult||{};
  const payload={
    type:'lead',
    name:document.getElementById('leadName').value.trim(),
    company:document.getElementById('leadCompany').value.trim(),
    phone:document.getElementById('leadPhone').value.trim(),
    comment:'',
    result:res
  };
  await postHook(payload);
  document.getElementById('leadForm').style.display='none';
  document.getElementById('resultText').innerHTML=`<b>Спасибо!</b> Контакты отправлены.`;
};

// Обсудить с экспертом — сначала модалка, после ОК открываем @chelebaev
document.getElementById('ctaExpert').onclick=async()=>{
  const r=window.__lastAuditResult;
  const msg=r
    ? `Здравствуйте! Хочу обсудить аудит печати.\nСчёт: ${r.score}/11, вердикт: ${r.verdict}.`
    : `Здравствуйте! Хочу обсудить аудит печати.`;
  try{ await navigator.clipboard.writeText(msg); }catch(_){}
  showModal(`Текст скопирован.<br>Нажмите «ОК», откроем <b>@chelebaev</b>, вставьте сообщение и отправьте.`, ()=>{
    window.location.href='https://t.me/chelebaev';
  });
};

// ===== Вебинары (мультивыбор) =====
const pollForm=document.getElementById('pollForm');
pollForm.addEventListener('click',e=>{
  const b=e.target.closest('.pill'); if(!b) return; b.classList.toggle('selected');
});
document.getElementById('sendPoll').onclick=async()=>{
  const selected=[...pollForm.querySelectorAll('.pill.selected')].map(b=>b.dataset.topic);
  const other=document.getElementById('pollOther').value.trim();
  if(!selected.length && !other){ alert('Выберите хотя бы одну тему или укажите свою.'); return; }

  const batch=[];
  selected.forEach(t=>batch.push({type:'poll',poll:'webinar_topic',topic:t,other:''}));
  if(other) batch.push({type:'poll',poll:'webinar_topic',topic:'Другая тема',other});

  for(const p of batch){ await postHook(p); }
  alert('Голос учтён!');
  const sum=await getSummaryRobust(); if(sum && sum.length) renderSummary(sum);
  show('screen-start');
};

// ===== Центр. модалка =====
function showModal(html, onOk){
  const o=document.createElement('div'); o.className='toast-overlay';
  o.innerHTML=`<div class="toast-box">${html}<br><br><div class="btn btn-primary" id="__ok">ОК</div></div>`;
  document.body.appendChild(o);
  const close=()=>{ o.remove(); if(typeof onOk==='function') onOk(); };
  o.addEventListener('click',(e)=>{ if(e.target.id==='__ok' || e.target===o) close(); });
}
