import { api } from './api.js';
import { el, DAYS, SLOTS } from './ui.js';

export async function renderTimetable(root, { rerender }) {
  const timetable = await api.getTimetable();
  const panel = el('section', { className: 'panel' });
  panel.innerHTML = `<h2>Weekly Timetable</h2><p class="sub">Click any slot to set the subject or activity.</p>`;
  const grid = el('div', { className: 'tt-grid' });
  grid.appendChild(el('div', { className: 'head' }));
  DAYS.forEach(d => grid.appendChild(el('div', { className: 'head' }, d)));
  SLOTS.forEach(slot => {
    grid.appendChild(el('div', { className: 'head' }, slot));
    DAYS.forEach(day => {
      const entry = timetable.find(e => e.day === day && e.slot === slot);
      const cell = el('div', { className: 'tt-cell' }, entry ? `<div class="tt-entry">${entry.text}</div>` : '');
      cell.onclick = async () => {
        const val = prompt('Slot: ' + day + ' ' + slot, entry ? entry.text : '');
        if (val === null) return;
        await api.setTimetableSlot(day, slot, val.trim());
        rerender();
      };
      grid.appendChild(cell);
    });
  });
  panel.appendChild(grid);
  root.appendChild(panel);
}
