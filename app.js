function show(id){
  ['screen-start','screen-audit','screen-poll'].forEach(x=>document.getElementById(x).style.display='none');
  document.getElementById(id).style.display='block';
}
['goAudit','goPoll','backStart1','backStart2'].forEach(id=>{
  const el=document.getElementById(id);
  if(!el)return;
  el.onclick=()=>{ 
    if(id==='goAudit') show('screen-audit');
    else if(id==='goPoll') show('screen-poll');
    else show('screen-start');
  };
});

const HOOK=window.LEKOM_HOOK||'';
async function postHook(payload){if(!HOOK)return;try{await fetch(HOOK,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});}catch(_){}}

// ===== Итоги =====
async function getSummary(){
  try{
    const u=new URL(HOOK);u.searchParams.set('summary','webinar');
    const r=await fetch(u.toString());const t=await r.text();
    const m=t.match(/\[.+\]/s);return m?JSON.parse(m[0]):null;
  }catch(_){return null;}
}
function renderSummary(d){
  const box=document.getElementById('summaryContent');
  if(!d||!d.length){box.textContent='Нет данных по голосованию.';return;}
  box.innerHTML='';const tot=d.reduce((a,x)=>a+x.count,0);
  box.insertAdjacentHTML('beforeend',`<div class="muted">Всего голосов: ${tot}</div>`);
  d.forEach(x=>{
    const pct=tot?Math.round(x.count*100/tot):0;
    box.insertAdjacentHTML('beforeend',`
      <div class="summary-row">
        <div class="summary-head"><div>${x.label}</div><div class="muted">${x.count} (${pct}%)</div></div>
        <div class="summary-bar"><div class="summary-fill" style="width:${pct}%"></div></div>
      </div>`);
  });
}
renderSummary([{label:'Обзор рынка и тренды 2025',count:0},{label:'Импортозамещение',count:0}]);
getSummary().then(s=>{if(s)renderSummary(s);});

// ===== Аудит =====
const auditForm=document.getElementById('auditForm');
const auditProgress=document.getElementById('auditProgress');const TOTAL=11;
auditForm.addEventListener('click',e=>{
  const b=e.target.closest('.pill');if(!b)return;
  const q=b.dataset.q;
  auditForm.querySelectorAll(`.pill[data-q="${q}"]`).forEach(x=>x.classList.remove('selected'));
  b.classList.add('selected');
  const a=new Set([...auditForm.querySelectorAll('.pill.selected')].map(x=>x.dataset.q)).size;
  auditProgress.textContent=`Ответы: ${a} / ${TOTAL}`;
});
document.getElementById('btnAuditResult').onclick=()=>{
  const sel=[...auditForm.querySelectorAll('.pill.selected')];
  let score=0;sel.forEach(b=>score+=Number(b.dataset.score||0));
  const verdict=score>8?'Зрелая инфраструктура':score>5?'Частичный контроль':'Нужен аудит';
  const resultText=document.getElementById('resultText');
  resultText.innerHTML=`Итоговый счёт: <b>${score}/11</b><br>Вердикт: <b>${verdict}</b>`;
  postHook({type:'result',score,verdict});
  window.__lastAuditResult={score,verdict};
};

// ===== Эксперт =====
document.getElementById('ctaExpert').onclick=async()=>{
  const r=window.__lastAuditResult;
  const msg=r?`Здравствуйте! Хочу обсудить аудит печати.\nСчёт: ${r.score}/11, вердикт: ${r.verdict}.`:`Здравствуйте! Хочу обсудить аудит печати.`;
  try{await navigator.clipboard.writeText(msg);}catch(_){}
  showModal(`Текст скопирован.<br>Откройте <b>@chelebaev</b> и вставьте сообщение.`);
};

// ===== Лид =====
document.getElementById('toggleLead').onclick=()=>{
  const f=document.getElementById('leadForm');
  f.style.display=f.style.display==='none'||!f.style.display?'block':'none';
};
document.getElementById('sendLead').onclick=async()=>{
  const name=document.getElementById('leadName').value.trim();
  const company=document.getElementById('leadCompany').value.trim();
  const phone=document.getElementById('leadPhone').value.trim();
  await postHook({type:'lead',name,company,phone,result:window.__lastAuditResult||{}});
  document.getElementById('leadForm').style.display='none';
  const box=document.getElementById('resultText');
  box.innerHTML=`<b>Спасибо!</b> Контакты отправлены.<br><div style="margin-top:8px;"><a href="https://t.me/LekomIT" target="_blank" class="btn btn-primary" style="display:inline-block;width:auto;">📢 Подписаться на @LekomIT</a></div>`;
};

// ===== Вебинары =====
const pollForm=document.getElementById('pollForm');
pollForm.addEventListener('click',e=>{
  const b=e.target.closest('.pill');if(!b)return;b.classList.toggle('selected');
});
document.getElementById('sendPoll').onclick=async()=>{
  const selected=[...pollForm.querySelectorAll('.pill.selected')].map(b=>b.dataset.topic);
  const other=document.getElementById('pollOther').value.trim();
  if(!selected.length&&!other){alert('Выберите хотя бы одну тему');return;}
  const payloads=[];
  selected.forEach(t=>payloads.push({type:'poll',poll:'webinar_topic',topic:t,other:''}));
  if(other)payloads.push({type:'poll',poll:'webinar_topic',topic:'Другая тема',other});
  for(const p of payloads){await postHook(p);}
  alert('Голос учтён!');
  const sum=await getSummary();if(sum)renderSummary(sum);
  show('screen-start');
};

// ===== Модалка =====
function showModal(html){
  const o=document.createElement('div');
  o.className='toast-overlay';
  o.innerHTML=`<div class="toast-box">${html}<br><br><button class="btn btn-primary" style="width:auto;">ОК</button></div>`;
  document.body.appendChild(o);
  o.querySelector('button').onclick=()=>o.remove();
}
