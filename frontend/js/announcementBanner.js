import { api } from './api.js';
import { el } from './ui.js';

export async function renderAnnouncementBanner(root) {
  const announcements = await api.getAnnouncements();
  if (announcements.length === 0) return;
  const box = el('section', { className: 'panel' });
  box.innerHTML = `<h2 style="font-size:15px;">📌 Notices</h2>`;
  announcements.slice().reverse().slice(0, 3).forEach(a => {
    box.appendChild(el('div', { className: 'ann-item' }, `${a.text}<div class="ann-date">${a.date}</div>`));
  });
  root.appendChild(box);
}
