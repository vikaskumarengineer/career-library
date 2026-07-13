import { api } from './api.js';
import { el, distributionBars } from './ui.js';

export async function renderLeaderboard(root) {
  const totals = await api.getLeaderboard();
  const panel = el('section', { className: 'panel' });
  panel.innerHTML = `<h2>Study Leaderboard</h2><p class="sub">Ranked by total study hours logged (all time).</p>`;
  if (totals.length === 0) { panel.innerHTML += `<p class="empty">No students yet.</p>`; root.appendChild(panel); return; }

  const sorted = totals.slice().sort((a, b) => b.total - a.total);
  sorted.slice(0, 5).forEach((t, i) => {
    const row = el('div', { className: 'rank-row' });
    row.innerHTML = `<div class="rank-no">#${i + 1}</div><div style="flex:1;">${t.name}<div class="sub" style="margin:0;">${t.examTarget}</div></div><div class="mono" style="color:var(--amber);font-weight:700;">${t.total.toFixed(1)}h</div>`;
    panel.appendChild(row);
  });
  root.appendChild(panel);

  const batchPanel = el('section', { className: 'panel' });
  batchPanel.innerHTML = `<h2>Batch-wise Average</h2><p class="sub">Average total study hours per exam target.</p>`;
  const groups = {};
  sorted.forEach(t => { groups[t.examTarget] = groups[t.examTarget] || []; groups[t.examTarget].push(t.total); });
  const averages = Object.entries(groups).map(([grp, arr]) => [grp, arr.reduce((a, b) => a + b, 0) / arr.length]);
  batchPanel.appendChild(distributionBars(averages));
  root.appendChild(batchPanel);
}
