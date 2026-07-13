import { api } from './api.js';
import { el, downloadCSV, barChart, MONTH_PREFIX, TODAY } from './ui.js';

export async function renderReports(root) {
  // ---- Fee summary ----
  const feeReport = await api.getFeeReport();
  const feePanel = el('section', { className: 'panel' });
  feePanel.innerHTML = `
    <h2>Fee Collection Summary</h2>
    <div class="stat-grid">
      <div class="stat open"><div class="num">₹${feeReport.totalPaid}</div><div class="lbl">Collected</div></div>
      <div class="stat closed"><div class="num">₹${feeReport.totalDue}</div><div class="lbl">Pending</div></div>
    </div>
  `;
  const exportFeesBtn = el('button', { className: 'btn ghost', style: 'margin-top:12px;' }, 'Export Fee Report (CSV)');
  exportFeesBtn.onclick = () => {
    const rows = [['Name', 'Roll', 'Amount', 'Status']].concat(feeReport.students.map(s => [s.name, s.roll, s.feeAmount, s.feeStatus]));
    downloadCSV('fee-report.csv', rows);
  };
  feePanel.appendChild(exportFeesBtn);
  root.appendChild(feePanel);

  // ---- Monthly attendance ----
  const [students, totals] = await Promise.all([api.getStudents(), api.attendanceReport(MONTH_PREFIX)]);
  const attPanel = el('section', { className: 'panel' });
  attPanel.innerHTML = `<h2>Monthly Attendance Report — ${MONTH_PREFIX}</h2><p class="sub">Total hours logged this month, based on completed check-in/check-out pairs.</p>`;
  const entries = Object.entries(totals);
  if (entries.length === 0) {
    attPanel.innerHTML += `<p class="empty">No completed attendance records yet this month.</p>`;
  } else {
    const wrap = el('div', { className: 'table-scroll' });
    const table = el('table');
    table.innerHTML = `
      <thead><tr><th>Name</th><th>Hours this month</th></tr></thead>
      <tbody>${entries.sort((a, b) => b[1] - a[1]).map(([id, h]) => {
        const s = students.find(x => x.id === id);
        return `<tr><td>${s ? s.name : 'Unknown'}</td><td class="mono">${h.toFixed(1)}h</td></tr>`;
      }).join('')}</tbody>
    `;
    wrap.appendChild(table); attPanel.appendChild(wrap);
    const exportBtn = el('button', { className: 'btn ghost', style: 'margin-top:12px;' }, 'Export Attendance (CSV)');
    exportBtn.onclick = () => {
      const rows = [['Name', 'Hours this month']].concat(entries.map(([id, h]) => {
        const s = students.find(x => x.id === id);
        return [s ? s.name : 'Unknown', h.toFixed(1)];
      }));
      downloadCSV('attendance-report-' + MONTH_PREFIX + '.csv', rows);
    };
    attPanel.appendChild(exportBtn);
  }
  root.appendChild(attPanel);

  // ---- Today's occupancy by hour ----
  const buckets = await api.getOccupancy(TODAY);
  const occPanel = el('section', { className: 'panel' });
  occPanel.innerHTML = `<h2>Today's Check-in Times</h2><p class="sub">When students arrived today, by hour.</p>`;
  const hours = Object.keys(buckets).map(Number).sort((a, b) => a - b);
  if (hours.length === 0) occPanel.innerHTML += `<p class="empty">No check-ins yet today.</p>`;
  else occPanel.appendChild(barChart(hours.map(h => ({ label: h + ':00', total: buckets[h] }))));
  root.appendChild(occPanel);
}
