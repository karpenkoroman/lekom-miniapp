// переключение экранов
function show(id){
  document.querySelectorAll('.app').forEach(x=>x.style.display='none');
  document.getElementById(id).style.display='block';
}

// переходы
document.getElementById('goAudit').onclick=()=>show('screen-audit');
document.getElementById('goPoll').onclick =()=>show('screen-poll');
document.getElementById('backStart1').onclick=()=>show('screen-start');
document.getElementById('backStart2').onclick=()=>show('screen-start');

// --- АУДИТ ---
const auditForm=document.getElementById('auditForm');
const prog=document.getElementById('auditProgress');
const resultText=document.getElementById('resultText');
let totalQ=11;

auditForm.addEventListener('click',e=>{
  const b=e.target.closest('.pill');
  if(!b)return;
  const q=b.dataset.q;
  auditForm.querySelectorAll(`.pill[data-q="${q}"]`).forEach(x=>x.classList.remove('selected'));
  b.classList.add('selected');
  updateProgress();
});

function updateProgress(){
  const a=new Set([...auditForm.querySelectorAll('.pill.selected')].map(x=>x.dataset.q)).size;
  prog.textContent=`Ответы: ${a} / ${totalQ}`;
}

document.getElementById('btnAuditResult').onclick=()=>{
  const sel=[...auditForm.querySelectorAll('.pill.selected')];
  let score=0;
  sel.forEach(b=>score+=Number(b.dataset.score||0));
  const verdict=score>8?'Зрелая инфраструктура':score>5?'Частичный контроль':'Нужен аудит';
  resultText.innerHTML=`Итоговый счёт: <b>${score}/11</b><br>Вердикт: <b>${verdict}</b>`;
};

// --- ЛИД-ФОРМА ---
const toggleLead=document.getElementById('toggleLead');
const leadForm=document.getElementById('leadForm');
toggleLead.onclick=()=>leadForm.style.display=leadForm.style.display==='none'?'block':'none';

// --- ВЕБИНАР ---
const pollForm=document.getElementById('pollForm');
pollForm.addEventListener('click',e=>{
  const b=e.target.closest('.pill'); if(!b)return;
  b.classList.toggle('selected'); // теперь можно выбрать несколько
});

document.getElementById('sendPoll').onclick=()=>{
  const selected=[...pollForm.querySelectorAll('.pill.selected')].map(b=>b.dataset.topic);
  if(!selected.length){alert('Выберите хотя бы одну тему');return;}
  alert('Голос учтён:\n' + selected.join(', '));
  // тут можно отправить выбранные темы через fetch на webhook
};

// --- СТАТИСТИКА ---
function renderSummary(data){
  const box=document.getElementById('summaryContent');
  box.innerHTML='';
  const total=data.reduce((a,x)=>a+x.count,0);
  box.insertAdjacentHTML('beforeend',`<div class="muted">Всего голосов: ${total}</div>`);
  data.forEach(d=>{
    const pct=total?Math.round(d.count*100/total):0;
    box.insertAdjacentHTML('beforeend',`
      <div class="summary-row">
        <div>${d.label} — ${d.count} (${pct}%)</div>
        <div class="summary-bar"><div class="summary-fill" style="width:${pct}%"></div></div>
      </div>`);
  });
}

// тестовые данные
renderSummary([
  {label:'Безопасность данных',count:5},
  {label:'Импортозамещение',count:3},
  {label:'Обзор рынка',count:2},
]);
