// /dashboard/main.js  v16

// === CONFIG ===
const GAS_URL =
  window.GAS_DASHBOARD_URL ||
  'https://script.google.com/macros/s/AKfycbwvlwGiji1VcgwkMHBVmSCJgDbDYRJlS5okIjY6PHdKaXf3RowHb6wlt6eeiIMcgCAB0w/exec?dashboard=public';

// Палитра в стиле мини-аппа
const COLORS = ['#2a7de1', '#5ec2ff', '#10b3a3']; // Нужен аудит / Частичный контроль / Зрелая практика
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
// разбивка длинных подписей на 1–2 строки
function splitLabelSmart(s){
  const max = 18;
  if (!s || s.length <= max) return [s];
  const words = s.split(' ');
  if (words.length < 2) return [s];
  let best = [s], minDiff = 1e9;
  for (let cut=1; cut<words.length; cut++){
    const a = words.slice(0,cut).join(' '), b = words.slice(cut).join(' ');
    const diff = Math.abs(a.length - b.length);
    if (diff < minDiff){ minDiff = diff; best = [a,b]; }
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

      if (avg !== undefined && avg !== null && avg !== ''){
        ctx.font = '600 14px Work Sans, system-ui, sans-serif';
        ctx.fillStyle = MUTED;
        ctx.shadowBlur = 0;
        ctx.fillText(`Средний балл ${avg}`, cx, cy + 34); // больше зазор
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

        const angle = (arc.startAngle + arc.endAngle) / 2;
        const ir = arc.innerRadius, or = arc.outerRadius;

        const isTiny = prc <= 4;
        const rPct   = isTiny ? 0.54 : 0.61; // ближе к центру для маленьких
        const r      = ir + (or - ir) * rPct;
        const x      = arc.x + Math.cos(angle) * r;
        const y      = arc.y + Math.sin(angle) * r;

        // подпись (название) — жирнее + обводка для читабельности
        const raw = String(labels[idx] || '');
        const lines = splitLabelSmart(raw);

        // настройка шрифтов
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = 'rgba(0,0,0,.65)'; // тонкая обводка
        ctx.lineWidth = 2;

        // название
        ctx.font = `${isTiny ? '800 11px' : '800 13px'} Work Sans, system-ui, sans-serif`;
        if (lines.length === 1){
          // сначала обводка, потом заливка
          ctx.strokeText(lines[0], x, y - (isTiny ? 14 : 18));
          ctx.fillText(  lines[0], x, y - (isTiny ? 14 : 18));
        } else {
          ctx.strokeText(lines[0], x, y - (isTiny ? 18 : 22));
          ctx.fillText(  lines[0], x, y - (isTiny ? 18 : 22));
          ctx.strokeText(lines[1], x, y - (isTiny ? 4  : 8 ));
          ctx.fillText(  lines[1], x, y - (isTiny ? 4  : 8 ));
        }

        // процент — ниже и с зазором побольше, чтобы не налезал
        ctx.font = `${isTiny ? '900 12px' : '900 14px'} Work Sans, system-ui, sans-serif`;
        ctx.strokeText(`${prc}%`, x, y + (isTiny ? 12 : 14));
        ctx.fillText(  `${prc}%`, x, y + (isTiny ? 12 : 14));
      });

      ctx.restore();
    }
  };
}

// === RENDER ===
function renderDonut(canvas, verdictMap, total, avgScore){
  const order = ['Нужен аудит', 'Частичный контроль', 'Зрелая практика'];

  const items = order
    .filter(k => verdictMap[k] != null)
    .map(k => ({ label: k, value: +verdictMap[k] || 0 }))
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
      cutout: '58%',
      layout: { padding: 12 },
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

    // одна метка «Обновлено: …»
    const ts = data.audit?.lastUpdate || data.leads?.lastUpdate || data.cta?.lastUpdate || null;
    lastRow.textContent = ts ? `Обновлено: ${fmtIsoToLocal(ts)}` : 'Обновлено: —';

    renderDonut(
      canvas,
      data.audit?.verdicts || {},
      data.audit?.total ?? 0,
      data.audit?.avgScore ?? 0
    );

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
