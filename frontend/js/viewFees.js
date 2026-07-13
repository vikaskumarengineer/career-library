import { api } from './api.js';
import { el, monthLabel, downloadFeeReceipt } from './ui.js';

export async function renderFees(root, { rerender }) {
  const [students, settings] = await Promise.all([api.getStudents(), api.getSettings()]);
  const panel = el('section', { className: 'panel' });
  panel.innerHTML = `<h2>Fee Structure</h2><p class="sub">Month-wise fee status for every student — a new month appears automatically as "due" once it starts.</p>`;
  if (students.length === 0) { panel.innerHTML += `<p class="empty">No students yet.</p>`; root.appendChild(panel); return; }

  students.forEach(s => {
    const history = s.feeHistory || {};
    const months = Object.keys(history).sort().reverse(); // most recent first
    const currentKey = months[0];
    const currentEntry = currentKey ? history[currentKey] : null;

    const card = el('div', { className: 'fee-card' });

    const header = el('div', { className: 'fee-card-header' });
    header.innerHTML = `
      <div>
        <strong>${s.name}</strong> <span class="mono" style="color:var(--ink-dim);font-size:12px;">${s.roll}</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        ${currentEntry ? `<span class="pill ${currentEntry.status === 'paid' ? 'paid' : (currentEntry.status === 'claimed' ? 'pending' : 'due')}">${monthLabel(currentKey)}: ${currentEntry.status === 'claimed' ? 'payment claimed — review' : currentEntry.status}</span>` : ''}
        <button class="btn ghost fee-expand" style="font-size:11px;padding:6px 10px;min-height:auto;">${months.length} month${months.length === 1 ? '' : 's'} ▾</button>
      </div>
    `;
    card.appendChild(header);

    const body = el('div', { className: 'fee-card-body' });
    body.style.display = 'none';
    months.forEach(key => {
      const entry = history[key];
      const row = el('div', { className: 'fee-month-row' });
      row.innerHTML = `
        <span class="fee-month-label">${monthLabel(key)}</span>
        <span class="mono">₹${entry.amount}</span>
        <span class="pill ${entry.status === 'paid' ? 'paid' : (entry.status === 'claimed' ? 'pending' : 'due')}">${entry.status === 'claimed' ? 'pending review' : entry.status}</span>
        <span class="sub" style="margin:0;font-size:11px;min-width:110px;">${entry.paidDate ? 'Paid ' + entry.paidDate : (entry.status === 'claimed' ? 'Student says paid — verify & confirm' : '')}</span>
        <button class="btn ${entry.status === 'paid' ? 'ghost' : ''}" data-toggle="${s.id}|${key}" style="font-size:11px;padding:6px 10px;min-height:auto;">${entry.status === 'paid' ? 'Mark Due' : (entry.status === 'claimed' ? 'Confirm Paid' : 'Mark Paid')}</button>
        ${entry.status === 'paid' ? `<button class="btn ghost" data-receipt="${s.id}|${key}" style="font-size:11px;padding:6px 10px;min-height:auto;">Download Receipt</button>` : ''}
      `;
      body.appendChild(row);
    });
    card.appendChild(body);

    header.querySelector('.fee-expand').onclick = () => {
      body.style.display = body.style.display === 'none' ? 'block' : 'none';
    };

    panel.appendChild(card);
  });

  root.appendChild(panel);
  panel.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.onclick = async () => {
      const [id, key] = btn.getAttribute('data-toggle').split('|');
      const student = students.find(s => s.id === id);
      const newStatus = student.feeHistory[key].status === 'paid' ? 'due' : 'paid';
      await api.setFeeMonth(id, key, newStatus);
      rerender();
    };
  });
  panel.querySelectorAll('[data-receipt]').forEach(btn => {
    btn.onclick = () => {
      const [id, key] = btn.getAttribute('data-receipt').split('|');
      const student = students.find(s => s.id === id);
      downloadFeeReceipt(student, key, student.feeHistory[key], settings);
    };
  });
}
