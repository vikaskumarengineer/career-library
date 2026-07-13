import { api } from './api.js';
import { el } from './ui.js';

let locationMap = null; // keep a reference so we can destroy/recreate on re-render

export async function renderLocation(root) {
  const settings = await api.getSettings();

  const infoPanel = el('section', { className: 'panel' });
  infoPanel.innerHTML = `<h2>${settings.libraryName || 'Find Us'}</h2><p class="sub">${settings.address || ''}</p>`;
  root.appendChild(infoPanel);

  const mapPanel = el('section', { className: 'panel' });
  mapPanel.innerHTML = `<h2>Find Us</h2>`;
  const mapBox = el('div', { className: 'map-box' });
  mapBox.id = 'locationMap';
  mapPanel.appendChild(mapBox);
  root.appendChild(mapPanel);

  if (settings.adminPhone) {
    const contactPanel = el('section', { className: 'panel' });
    contactPanel.innerHTML = `<h2>Contact</h2><p class="sub">📞 <a href="tel:${settings.adminPhone}">${settings.adminPhone}</a></p>`;
    root.appendChild(contactPanel);
  }

  requestAnimationFrame(() => {
    if (locationMap) { locationMap.remove(); locationMap = null; }
    if (window.L && document.getElementById('locationMap')) {
      locationMap = L.map('locationMap').setView([settings.lat, settings.lng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(locationMap);
      L.marker([settings.lat, settings.lng]).addTo(locationMap)
        .bindPopup(settings.libraryName).openPopup();
    }
  });
}
