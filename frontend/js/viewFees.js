import { api } from './api.js';
import { el, monthLabel, downloadFeeReceipt, downloadCSV } from './ui.js';

export async function renderFees(root, { rerender }) {
  const [students, settings] = await Promise.all([api.getStudents(), api.getSettings()]);
  const panel = el('section', { className: 'panel' });
  panel.innerHTML = `<h2>Fee Structure</h2><p class="sub">Month-wise fee status for every student — a new month appears automatically as "due" once it starts.</p>`;
  if (students.length === 0) { panel.innerHTML += `<p class="empty">No students yet.</p>`; root.appendChild(panel); return; }

  // ---- Download all records ----
  const downloadRow = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;' });
  const csvBtn = el('button', { className: 'btn ghost' }, '📥 Export All Records (CSV)');
  const zipBtn = el('button', { className: 'btn ghost' }, '🗜️ Download All Payment Screenshots (ZIP)');
  downloadRow.appendChild(csvBtn);
  downloadRow.appendChild(zipBtn);
  panel.appendChild(downloadRow);

  csvBtn.onclick = () => {
    const rows = [['Name', 'Roll', 'Month', 'Amount', 'Status', 'Paid Date', 'Screenshot Attached']];
    students.forEach(s => {
      const history = s.feeHistory || {};
      Object.keys(history).sort().forEach(key => {
        const entry = history[key];
        rows.push([s.name, s.roll, monthLabel(key), entry.amount, entry.status, entry.paidDate || '', entry.paymentProof ? 'Yes' : 'No']);
      });
    });
    downloadCSV('fee-records-all.csv', rows);
  };

  zipBtn.onclick = async () => {
    if (!window.JSZip) { alert('ZIP library did not load — check your internet connection and try again.'); return; }
    const zip = new JSZip();
    let count = 0;
    students.forEach(s => {
      const history = s.feeHistory || {};
      Object.keys(history).forEach(key => {
        const entry = history[key];
        if (!entry.paymentProof) return;
        const base64 = entry.paymentProof.split(',')[1];
        const safeName = s.name.replace(/[^a-z0-9]/gi, '_');
        zip.file(`${safeName}_${s.roll}_${key}.jpg`, base64, { base64: true });
        count++;
      });
    });
    if (count === 0) { alert('No payment screenshots have been uploaded yet.'); return; }
    zipBtn.disabled = true; zipBtn.textContent = 'Building ZIP…';
    try {
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'payment-screenshots.zip'; document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } finally {
      zipBtn.disabled = false; zipBtn.textContent = '🗜️ Download All Payment Screenshots (ZIP)';
    }
  };

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
        ${entry.paymentProof ? `<button class="btn ghost" data-proof="${s.id}|${key}" style="font-size:11px;padding:6px 10px;min-height:auto;">📎 View Screenshot</button>` : ''}
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
  panel.querySelectorAll('[data-proof]').forEach(btn => {
    btn.onclick = () => {
      const [id, key] = btn.getAttribute('data-proof').split('|');
      const student = students.find(s => s.id === id);
      openProofViewer(student, key, student.feeHistory[key]);
    };
  });
}

function openProofViewer(student, monthKey, entry) {
  const overlay = el('div', { className: 'overlay' });
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div class="ticket" style="width:auto;max-width:90vw;">
      <button class="close">&times;</button>
      <p class="mono" style="color:var(--amber);font-size:11px;letter-spacing:1px;">PAYMENT SCREENSHOT</p>
      <h3>${student.name} — ${monthLabel(monthKey)} (₹${entry.amount})</h3>
      <img src="${entry.paymentProof}" alt="Payment screenshot" style="max-width:80vw;max-height:70vh;border-radius:8px;margin-top:10px;display:block;">
      <a href="${entry.paymentProof}" download="${student.roll}_${monthKey}_proof.jpg" class="btn" style="margin-top:14px;display:inline-block;text-decoration:none;">Download This Screenshot</a>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('.close').onclick = () => overlay.remove();
}
