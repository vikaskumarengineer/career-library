import { api } from './api.js';
import { el } from './ui.js';

export async function openSeatTicket(seatNo, { rerender }) {
  const [students, seats] = await Promise.all([api.getStudents(), api.getSeats()]);
  const seat = seats.find(s => s.seatNo === seatNo);
  const occupant = seat.occupantId ? students.find(s => s.id === seat.occupantId) : null;

  const overlay = el('div', { className: 'overlay' });
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  let bodyHtml = '';
  if (occupant) {
    bodyHtml = `
      <p style="margin:10px 0 4px;color:var(--ink-dim);font-size:12.5px;">Currently seated</p>
      <h3>${occupant.name}</h3>
      <p class="mono" style="color:var(--ink-dim);font-size:12.5px;">${occupant.examTarget} · ${occupant.gender} · ${seat.shift || 'Full Day'}</p>
      ${seat.holdUntil ? `<p class="sub" style="color:var(--amber);">Hold expires: ${new Date(seat.holdUntil).toLocaleString('en-IN')}</p>` : ''}
      <button class="btn danger" id="releaseBtn" style="margin-top:14px;">Release Seat</button>
    `;
  } else {
    const free = students.filter(s => !seats.some(se => se.occupantId === s.id));
    const options = free.map(s => `<option value="${s.id}">${s.name} (${s.examTarget})</option>`).join('');
    bodyHtml = `
      <p style="margin:10px 0 4px;color:var(--ink-dim);font-size:12.5px;">Assign this open seat</p>
      <label>Student</label>
      <select id="assignSelect" style="margin-bottom:10px;"><option value="">— choose student —</option>${options}</select>
      <label>Shift</label>
      <select id="assignShift" style="margin-bottom:12px;"><option>Full Day</option><option>Morning</option><option>Evening</option></select>
      <button class="btn" id="assignBtn">Assign Seat</button>
      ${free.length === 0 ? '<p class="sub" style="margin-top:8px;">Every registered student already has a seat.</p>' : ''}
    `;
  }

  overlay.innerHTML = `
    <div class="ticket">
      <button class="close">&times;</button>
      <p class="mono" style="color:var(--amber);font-size:11px;letter-spacing:1px;">SEAT TICKET</p>
      <h2 class="mono" style="font-size:28px;">#${seatNo}</h2>
      ${bodyHtml}
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('.close').onclick = () => overlay.remove();

  const assignBtn = overlay.querySelector('#assignBtn');
  if (assignBtn) {
    assignBtn.onclick = async () => {
      const val = overlay.querySelector('#assignSelect').value;
      if (!val) return;
      await api.assignSeat(seatNo, val, overlay.querySelector('#assignShift').value);
      overlay.remove();
      rerender();
    };
  }
  const releaseBtn = overlay.querySelector('#releaseBtn');
  if (releaseBtn) {
    releaseBtn.onclick = async () => {
      await api.releaseSeat(seatNo);
      overlay.remove();
      rerender();
    };
  }
}
