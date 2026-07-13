import { api } from './api.js';
import { el } from './ui.js';

let leafletMap = null; // keep a reference so we can destroy/recreate on re-render

export async function renderDashboard(root, { openSeatTicket }) {
  const [students, seats, settings, announcements] = await Promise.all([
    api.getStudents(), api.getSeats(), api.getSettings(), api.getAnnouncements()
  ]);

  const occ = seats.filter(s => s.occupantId).length;
  const open = seats.length - occ;
  const feeDue = students.filter(s => s.feeStatus === 'due').length;

  const statsPanel = el('section', { className: 'panel' });
  statsPanel.innerHTML = `
    <h2>Today's Overview</h2>
    <p class="sub">${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
    <div class="stat-grid">
      <div class="stat"><div class="num">${students.length}</div><div class="lbl">Total Students</div></div>
      <div class="stat open"><div class="num">${open}</div><div class="lbl">Seats Open</div></div>
      <div class="stat closed"><div class="num">${occ}</div><div class="lbl">Seats Occupied</div></div>
      <div class="stat warn"><div class="num">${feeDue}</div><div class="lbl">Fee Due</div></div>
    </div>
  `;
  root.appendChild(statsPanel);

  // ---- Library photo + map, side by side ----
  const mediaPanel = el('section', { className: 'panel' });
  mediaPanel.innerHTML = `<h2>${settings.libraryName}</h2><p class="sub">${settings.address || 'Add an address from the Settings tab'}</p>`;
  const mediaGrid = el('div', { className: 'media-grid' });

  const photoBox = el('div', { className: 'photo-box' });
  if (settings.photoUrl) {
    photoBox.innerHTML = `<img src="${settings.photoUrl}" alt="Library photo">`;
  } else {
    photoBox.innerHTML = `<div class="photo-placeholder">No photo yet — upload one from the Settings tab.</div>`;
  }
  mediaGrid.appendChild(photoBox);

  const mapBox = el('div', { className: 'map-box' });
  mapBox.id = 'dashboardMap';
  mediaGrid.appendChild(mapBox);

  mediaPanel.appendChild(mediaGrid);
  root.appendChild(mediaPanel);

  // Leaflet map (loaded via CDN in index.html) centered on the library's saved coordinates
  requestAnimationFrame(() => {
    if (leafletMap) { leafletMap.remove(); leafletMap = null; }
    if (window.L && document.getElementById('dashboardMap')) {
      leafletMap = L.map('dashboardMap').setView([settings.lat, settings.lng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(leafletMap);
      L.marker([settings.lat, settings.lng]).addTo(leafletMap)
        .bindPopup(settings.libraryName).openPopup();
    }
  });

  // ---- Announcements ----
  const annPanel = el('section', { className: 'panel' });
  annPanel.innerHTML = `<h2>Announcements</h2><p class="sub">Post a notice — it shows to students on Create Account and My Account.</p>`;
  const annForm = el('div', { style: 'display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;' });
  annForm.innerHTML = `<input id="annInput" placeholder="e.g. Library closed on Sunday" style="flex:1;min-width:200px;"><button class="btn" id="annBtn">Post</button>`;
  annPanel.appendChild(annForm);
  const annList = el('div');
  if (announcements.length === 0) annList.innerHTML = '<p class="empty">No announcements yet.</p>';
  else announcements.slice().reverse().slice(0, 6).forEach(a => {
    annList.appendChild(el('div', { className: 'ann-item' }, `${a.text}<div class="ann-date">${a.date}</div>`));
  });
  annPanel.appendChild(annList);
  root.appendChild(annPanel);
  annForm.querySelector('#annBtn').onclick = async () => {
    const val = annForm.querySelector('#annInput').value.trim();
    if (!val) return;
    await api.postAnnouncement(val);
    renderDashboard(clearAndReturn(root), { openSeatTicket });
  };

  // ---- Seat map ----
  const seatPanel = el('section', { className: 'panel' });
  seatPanel.innerHTML = `<h2>Seat Map — Ticket Style</h2><p class="sub">Click any seat to assign or release it. Amber border = self-signup hold, not yet checked in.</p>`;
  const grid = el('div', { className: 'seat-map' });
  seats.forEach(seat => {
    const student = seat.occupantId ? students.find(s => s.id === seat.occupantId) : null;
    const isHold = student && seat.holdUntil;
    const div = el('div', { className: 'seat ' + (student ? (isHold ? 'hold' : 'closed') : 'open') });
    div.innerHTML = `
      <div class="no mono">#${seat.seatNo}</div>
      <div class="who">${student ? student.name.split(' ')[0] : 'Open'}</div>
      ${student ? `<span class="dot ${student.gender === 'Girl' ? 'girl' : 'boy'}"></span>` : ''}
    `;
    div.onclick = () => openSeatTicket(seat.seatNo);
    grid.appendChild(div);
  });
  seatPanel.appendChild(grid);
  const legend = el('div', { className: 'legend' }, `
    <span><span class="sw" style="background:var(--open)"></span> Open</span>
    <span><span class="sw" style="background:var(--closed)"></span> Occupied</span>
    <span><span class="sw" style="background:var(--amber)"></span> On hold (unconfirmed)</span>
    <span><span class="sw" style="background:var(--boy);border-radius:50%"></span> Boy</span>
    <span><span class="sw" style="background:var(--girl);border-radius:50%"></span> Girl</span>
  `);
  seatPanel.appendChild(legend);
  root.appendChild(seatPanel);
}

function clearAndReturn(root) { root.innerHTML = ''; return root; }
