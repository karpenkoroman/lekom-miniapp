// /dashboard/main.js  — компактный пончик + карточка обращений

// === CONFIG ===
const GAS_URL =
  window.GAS_DASHBOARD_URL ||
  'https://script.google.com/macros/s/AKfycbwvlwGiji1VcgwkMHBVmSCJgDbDYRJlS5okIjY6PHdKaXf3RowHb6wlt6eeiIMcgCAB0w/exec?dashboard=public';

// Палитра в стиле мини-аппа
const COLORS = ['#2a7de1', '#5ec2ff', '#10b3a3']; // Нужен аудит / Частичный контроль / Зрелая практика (порядок ниже)
const BG      = '#171b25';
const TEXT    = '#eaf0fa';
const MUTED   = '#96a2c2';
const STROKE  = '#293044';

// === UTILS ===
async function fetchJSON(url){
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
function pct(v, t){ return t ? Math.round((v / t) * 100) : 0; }
function fmtIsoToLocal(iso){
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch(_){ return '—'; }
}
function splitLabelSmart(s){
  // Разбивка длинных русских подписей по пробелу на 2 строки, если слишком длинно
  const max = 18;
  if (!s || s.length <= max) return [s];
  const words = s.split(' ');
  if (words.length < 2) return [s];
  // пытаемся поровну
  let best = [s];
  let minDiff = 1e9;
  for (let cut=1; cut<words.length; cut++){
    const a = words.slice(0,cut).join(' ');
    const b = words.slice(cut).join(' ');
    const diff = Math.abs(a.length - b.length);
    if (diff < minDiff){
      minDiff = diff;
      best = [a, b];
    }
  }
  return best;
}

// === Chart.js plugins ===
function centerTextPlugin(totalGetter, avgGetter){
  return {
    id: 'centerText',
    afterDraw(chart){
      const { ctx, chartArea } = chart;
      const cx = (chartArea.left + chartArea.right) / 2;
      const cy = (chartArea.top + chartArea.bottom) / 2;
      const total = String(totalGetter() ?? '0');
      const avg   = avgGetter();

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // крупное число
      ctx.font = '900 32px Work Sans, system-ui, sans-serif';
      ctx.fillStyle = TEXT;
      ctx.shadowColor = 'rgba(0,0,0,.45)';
      ctx.shadowBlur  = 10;
      ctx.fillText(total, cx, cy - 10);

      // подпись «Средний балл N» — ниже, с приличным зазором
      if (avg !== undefined && avg !== null && avg !== ''){
        ctx.font = '600 14px Work Sans, system-ui, sans-serif';
        ctx.fillStyle = MUTED;
        ctx.shadowBlur = 0;
        ctx.fillText(`Средний балл ${avg}`, cx, cy + 30);
      }
      ctx.restore();
    }
  };
}

function sliceLabelsPlugin(labels, values){
  return {
    id: 'sliceLabels',
    afterDraw(chart){
      const { ctx, _metasets } = chart;
      if (!_metasets || !_metasets[0]) return;
      const meta  = _metasets[0];
      const total = values.reduce((s,x)=>s+x,0) || 1;

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      meta.data.forEach((arc, idx)=>{
        const v = values[idx];
        if (!v) return;
        const prc = Math.round((v / total) * 100);

        // Позиция подписи внутри сектора
        const angle = (arc.startAngle + arc.endAngle) / 2;
        const ir = arc.innerRadius;
        const or = arc.outerRadius;

        // Чем меньше доля — тем ближе к центру и тем меньше шрифт
        const isTiny = prc <= 4;
        const rPct   = isTiny ? 0.55 : 0.62;
        const r      = ir + (or - ir) * rPct;
        const x      = arc.x + Math.cos(angle) * r;
        const y      = arc.y + Math.sin(angle) * r;

        // Тень для читаемости
        ctx.shadowColor = 'rgba(0,0,0,.6)';
        ctx.shadowBlur  = 8;

        // Название доли — сверху, возможно в 2 строки
        const raw = String(labels[idx] || '');
        const lines = splitLabelSmart(raw);
        ctx.fillStyle = '#fff';
        ctx.font = `${isTiny ? '700 10px' : '700 12px'} Work Sans, system-ui, sans-serif`;

        if (lines.length === 1){
          ctx.fillText(lines[0], x, y - (isTiny ? 10 : 14));
        } else {
          ctx.fillText(lines[0], x, y - (isTiny ? 14 : 18));
          ctx.fillText(lines[1], x, y - (isTiny ? 2 : 6));
        }

        // Процент — под названием, чтобы не пересекался
        ctx.font = `${isTiny ? '800 11px' : '800 13px'} Work Sans, system-ui, sans-serif`;
        ctx.fillText(`${prc}%`, x, y + (isTiny ? 8 : 10));
      });

      ctx.restore();
    }
  };
}

// === RENDER ===
function renderDonut(canvas, verdictMap, total, avgScore){
  // Жёстко упорядочим доли, чтобы цвета совпадали со смыслом:
  // 1) «Нужен аудит» → COLORS[0]
  // 2) «Частичный контроль» → COLORS[1]
  // 3) «Зрелая практика» → COLORS[2]
  const order = ['Нужен аудит', 'Частичный контроль', 'Зрелая практика'];

  const items = order
    .filter(k => verdictMap[k] != null)
    .map(k => ({ label: k, value: +verdictMap[k] || 0 }))
    // добавим остальные, если внезапно появятся новые категории
    .concat(
      Object.entries(verdictMap)
        .filter(([k]) => !order.includes(k))
        .map(([k,v]) => ({ label:k, value:+v||0 }))
    )
    .filter(x => x.value > 0);

  const labels = items.map(x => x.label);
  const values = items.map(x => x.value);
  const colors = items.map(it => {
    const i = order.indexOf(it.label);
    return i >= 0 ? COLORS[i] : COLORS[COLORS.length - 1];
  });

  new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: BG,
        borderWidth: 2,
        hoverBorderColor: '#ffffff',
        hoverBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',                 // чуть меньше, чтобы было место для подписей
      layout: { padding: 10 },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: '#0f1522',
          borderColor: STROKE,
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: MUTED,
          callbacks: {
            title: (items)=> items[0]?.label ?? '',
            label: (ctx)=>{
              const sum = values.reduce((s,x)=>s+x,0) || 1;
              const val = ctx.parsed;
              const p   = pct(val, sum);
              return ` ${val} • ${p}%`;
            }
          }
        }
      }
    },
    plugins: [
      centerTextPlugin(()=> (values.reduce((s,x)=>s+x,0)), ()=> avgScore),
      sliceLabelsPlugin(labels, values)
    ]
  });
}

function renderLeadsBox(box, leads, cta){
  // независимый блок
  box.innerHTML = '';

  const title = document.createElement('h2');
  title.style.margin = '0 0 6px';
  title.style.fontSize = '18px';
  title.textContent = 'Статистика обращений';
  box.appendChild(title);

  const row = (name, val)=>{
    const d = document.createElement('div');
    d.style.display = 'flex';
    d.style.justifyContent = 'space-between';
    d.style.marginTop = '6px';
    const l = document.createElement('div'); l.className = 'muted'; l.textContent = name;
    const r = document.createElement('div'); r.innerHTML = `<b>${val}</b>`;
    d.append(l,r); return d;
  };

  // Только общие количества, без разбивок на периоды и без "уник. компаний"
  box.append(row('Индивидуальные обращения — всего', cta?.total ?? 0));
  box.append(row('Поделились контактами — всего',    leads?.total ?? 0));
}

// === BOOT ===
async function boot(){
  const canvas  = document.getElementById('auditPie');
  const leadsEl = document.getElementById('leadsBox');
  const lastRow = document.getElementById('lastRow');

  try{
    lastRow.textContent = 'Обновление…';
    const j = await fetchJSON(GAS_URL);
    const data = j?.data || {};

    // «Последняя запись …» одной строкой под заголовком
    const parts = [];
    if (data.audit?.lastUpdate) parts.push(`Последняя запись по аудитам: ${fmtIsoToLocal(data.audit.lastUpdate)}`);
    if (data.leads?.lastUpdate) parts.push(`Лиды: ${fmtIsoToLocal(data.leads.lastUpdate)}`);
    if (data.cta?.lastUpdate)   parts.push(`Обращения: ${fmtIsoToLocal(data.cta.lastUpdate)}`);
    lastRow.textContent = parts.join(' • ') || 'Нет данных';

    // диаграмма
    renderDonut(
      canvas,
      data.audit?.verdicts || {},
      data.audit?.total ?? 0,
      data.audit?.avgScore ?? 0
    );

    // карточка обращений
    renderLeadsBox(
      leadsEl,
      data.leads || { total:0, lastUpdate:null },
      data.cta   || { total:0, lastUpdate:null }
    );
  } catch (e){
    console.error(e);
    lastRow.textContent = 'Ошибка загрузки. Проверьте GAS URL и доступ.';
  }
}

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', boot, { once:true });
} else {
  boot();
}
