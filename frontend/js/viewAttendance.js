import { api } from './api.js';
import { el, fmtTime, TODAY } from './ui.js';

export async function renderAttendance(root, { rerender }) {
  const [students, attendanceToday] = await Promise.all([api.getStudents(), api.getAttendance(TODAY)]);

  const panel = el('section', { className: 'panel' });
  panel.innerHTML = `<h2>Attendance — ${TODAY}</h2><p class="sub">Check students in and out to track their library hours today.</p>`;
  if (students.length === 0) { panel.innerHTML += `<p class="empty">No students yet.</p>`; root.appendChild(panel); return; }

  const wrap = el('div', { className: 'table-scroll' });
  const table = el('table');
  table.innerHTML = `
    <thead><tr><th>Name</th><th>Status</th><th>Check-in</th><th>Check-out</th><th>Hours today</th><th></th></tr></thead>
    <tbody>
      ${students.map(s => {
        const rec = attendanceToday[s.id] || {};
        let hours = '—';
        if (rec.checkIn && rec.checkOut) hours = ((new Date(rec.checkOut) - new Date(rec.checkIn)) / 3600000).toFixed(1) + 'h';
        const status = rec.checkIn && !rec.checkOut ? 'in' : 'out';
        return `<tr>
          <td>${s.name}</td>
          <td><span class="pill ${status}">${status === 'in' ? 'In Library' : 'Not in'}</span></td>
          <td class="mono">${rec.checkIn ? fmtTime(rec.checkIn) : '—'}</td>
          <td class="mono">${rec.checkOut ? fmtTime(rec.checkOut) : '—'}</td>
          <td class="mono">${hours}</td>
          <td class="row-actions">
            <button class="btn" data-in="${s.id}" ${rec.checkIn && !rec.checkOut ? 'disabled' : ''}>Check-in</button>
            <button class="btn ghost" data-out="${s.id}" ${!rec.checkIn || rec.checkOut ? 'disabled' : ''}>Check-out</button>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  `;
  wrap.appendChild(table); panel.appendChild(wrap); root.appendChild(panel);

  panel.querySelectorAll('[data-in]').forEach(btn => {
    btn.onclick = async () => { await api.checkIn(TODAY, btn.getAttribute('data-in')); rerender(); };
  });
  panel.querySelectorAll('[data-out]').forEach(btn => {
    btn.onclick = async () => { await api.checkOut(TODAY, btn.getAttribute('data-out')); rerender(); };
  });
}
