import { api } from './api.js';
import { el } from './ui.js';

let pickerMap = null;
let pickerMarker = null;

export async function renderSettings(root, { rerender }) {
  const settings = await api.getSettings();

  // ---- Photo gallery (used for the Home page banner carousel) ----
  const photoPanel = el('section', { className: 'panel' });
  photoPanel.innerHTML = `<h2>Library Photos</h2><p class="sub">These rotate as a banner on the Home page. Upload as many as you like.</p>`;
  const photos = Array.isArray(settings.photos) ? settings.photos : [];
  const gallery = el('div', { className: 'photo-gallery' });
  if (photos.length === 0) {
    gallery.innerHTML = `<div class="photo-placeholder">No photos uploaded yet</div>`;
  } else {
    photos.forEach(url => {
      const thumb = el('div', { className: 'photo-thumb' });
      thumb.innerHTML = `<img src="${url}" alt="Library photo"><button class="thumb-remove" title="Remove">&times;</button>`;
      thumb.querySelector('.thumb-remove').onclick = async () => {
        await api.deletePhoto(url);
        rerender();
      };
      gallery.appendChild(thumb);
    });
  }
  photoPanel.appendChild(gallery);

  const fileInput = el('input', { type: 'file', id: 'photoFile', accept: 'image/*', style: 'margin:12px 0 10px;' });
  photoPanel.appendChild(fileInput);
  const uploadBtn = el('button', { className: 'btn' }, 'Add Photo');
  uploadBtn.onclick = async () => {
    const file = fileInput.files[0];
    if (!file) { alert('Choose an image file first.'); return; }
    uploadBtn.disabled = true; uploadBtn.textContent = 'Uploading…';
    try {
      await api.uploadPhoto(file);
      rerender();
    } catch (e) {
      alert('Upload failed: ' + e.message);
      uploadBtn.disabled = false; uploadBtn.textContent = 'Add Photo';
    }
  };
  photoPanel.appendChild(uploadBtn);
  root.appendChild(photoPanel);

  // ---- Library info + map location ----
  const mapPanel = el('section', { className: 'panel' });
  mapPanel.innerHTML = `<h2>Library Info & Map Location</h2><p class="sub">Click anywhere on the map to drop the pin at your library, or search an address below.</p>`;

  const form = el('div', { className: 'form-grid' });
  form.innerHTML = `
    <div><label>Library Name</label><input id="s_name" value="${settings.libraryName || ''}"></div>
    <div><label>Address</label><input id="s_address" value="${settings.address || ''}"></div>
    <div><label>Admin Contact Number</label><input id="s_phone" placeholder="e.g. 9876543210" value="${settings.adminPhone || ''}"></div>
  `;
  mapPanel.appendChild(form);

  const searchRow = el('div', { style: 'display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;' });
  searchRow.innerHTML = `<input id="s_search" placeholder="Search an address (e.g. Hazratganj, Lucknow)" style="flex:1;min-width:180px;"><button class="btn ghost" id="s_searchBtn">Search</button><button class="btn" id="s_geoBtn">📍 Use My Current Location</button>`;
  mapPanel.appendChild(searchRow);
  const geoStatus = el('div', { id: 's_geoStatus', className: 'sub', style: 'margin:-4px 0 10px;display:none;' });
  mapPanel.appendChild(geoStatus);

  const mapBox = el('div', { className: 'map-box', id: 'settingsMap' });
  mapPanel.appendChild(mapBox);

  const coordsRow = el('div', { className: 'form-grid', style: 'margin-top:12px;' });
  coordsRow.innerHTML = `
    <div><label>Latitude</label><input id="s_lat" type="number" step="0.0001" value="${settings.lat}"></div>
    <div><label>Longitude</label><input id="s_lng" type="number" step="0.0001" value="${settings.lng}"></div>
  `;
  mapPanel.appendChild(coordsRow);

  const saveBtn = el('button', { className: 'btn' }, 'Save Library Info');
  mapPanel.appendChild(saveBtn);
  root.appendChild(mapPanel);

  // set up the interactive picker map
  requestAnimationFrame(() => {
    if (pickerMap) { pickerMap.remove(); pickerMap = null; }
    if (!window.L) return;
    pickerMap = L.map('settingsMap').setView([settings.lat, settings.lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(pickerMap);
    pickerMarker = L.marker([settings.lat, settings.lng], { draggable: true }).addTo(pickerMap);

    const syncInputs = (lat, lng) => {
      mapPanel.querySelector('#s_lat').value = lat.toFixed(6);
      mapPanel.querySelector('#s_lng').value = lng.toFixed(6);
    };
    pickerMap.on('click', (e) => {
      pickerMarker.setLatLng(e.latlng);
      syncInputs(e.latlng.lat, e.latlng.lng);
    });
    pickerMarker.on('dragend', () => {
      const pos = pickerMarker.getLatLng();
      syncInputs(pos.lat, pos.lng);
    });
  });

  // address search via OpenStreetMap's free Nominatim geocoder (no API key needed)
  searchRow.querySelector('#s_searchBtn').onclick = async () => {
    const q = searchRow.querySelector('#s_search').value.trim();
    if (!q) return;
    searchRow.querySelector('#s_searchBtn').textContent = 'Searching…';
    try {
      const res = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q));
      const results = await res.json();
      if (results.length === 0) { alert('No location found for that search.'); return; }
      const { lat, lon } = results[0];
      mapPanel.querySelector('#s_lat').value = Number(lat).toFixed(6);
      mapPanel.querySelector('#s_lng').value = Number(lon).toFixed(6);
      if (pickerMap && pickerMarker) {
        pickerMap.setView([lat, lon], 16);
        pickerMarker.setLatLng([lat, lon]);
      }
    } catch (e) {
      alert('Search failed — check your internet connection.');
    } finally {
      searchRow.querySelector('#s_searchBtn').textContent = 'Search';
    }
  };

  // "Use My Current Location" — reads real GPS from the device this is
  // opened on. Only useful when clicked by someone actually standing at
  // the library (e.g. on the admin's phone), which is exactly the intended use.
  searchRow.querySelector('#s_geoBtn').onclick = () => {
    if (!navigator.geolocation) {
      alert('Your browser doesn\'t support location access. Try a different browser, or search/click the map instead.');
      return;
    }
    const btn = searchRow.querySelector('#s_geoBtn');
    btn.disabled = true; btn.textContent = 'Locating…';
    geoStatus.style.display = 'block';
    geoStatus.textContent = 'Requesting location permission — please allow it if your browser asks.';

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        mapPanel.querySelector('#s_lat').value = latitude.toFixed(6);
        mapPanel.querySelector('#s_lng').value = longitude.toFixed(6);
        if (pickerMap && pickerMarker) {
          pickerMap.setView([latitude, longitude], 17);
          pickerMarker.setLatLng([latitude, longitude]);
        }
        geoStatus.textContent = `Location set (accurate to about ${Math.round(accuracy)}m). Click "Save Library Info" below to keep it.`;
        btn.disabled = false; btn.textContent = '📍 Use My Current Location';
      },
      (err) => {
        let msg = 'Could not get your location.';
        if (err.code === err.PERMISSION_DENIED) msg = 'Location permission was denied. Allow location access in your browser settings and try again.';
        else if (err.code === err.POSITION_UNAVAILABLE) msg = 'Your device could not determine its location right now. Try again outdoors or near a window.';
        else if (err.code === err.TIMEOUT) msg = 'Location request timed out. Please try again.';
        geoStatus.textContent = msg;
        btn.disabled = false; btn.textContent = '📍 Use My Current Location';
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  saveBtn.onclick = async () => {
    await api.updateSettings({
      libraryName: mapPanel.querySelector('#s_name').value.trim(),
      address: mapPanel.querySelector('#s_address').value.trim(),
      adminPhone: mapPanel.querySelector('#s_phone').value.trim(),
      lat: Number(mapPanel.querySelector('#s_lat').value),
      lng: Number(mapPanel.querySelector('#s_lng').value)
    });
    alert('Saved!');
    rerender();
  };

  // ---- Automatic fee reminders ----
  const reminderPanel = el('section', { className: 'panel' });
  reminderPanel.innerHTML = `<h2>Fee Reminders</h2><p class="sub">Students who haven't paid yet automatically get a one-time notification on their My Account page once the month reaches this day.</p>`;
  const reminderForm = el('div', { className: 'form-grid' });
  reminderForm.innerHTML = `
    <div><label>Send reminder on day of month</label><input id="s_reminderDay" type="number" min="1" max="28" value="${settings.feeReminderDay || 5}"></div>
  `;
  reminderPanel.appendChild(reminderForm);
  const reminderSaveBtn = el('button', { className: 'btn' }, 'Save');
  reminderSaveBtn.onclick = async () => {
    await api.updateSettings({ feeReminderDay: Number(reminderForm.querySelector('#s_reminderDay').value) || 5 });
    alert('Saved!');
    rerender();
  };
  reminderPanel.appendChild(reminderSaveBtn);
  root.appendChild(reminderPanel);

  // ---- Admin password change ----
  const pwPanel = el('section', { className: 'panel' });
  pwPanel.innerHTML = `<h2>Change Admin Password</h2><p class="sub">Enter your current password and the new one you'd like to use.</p>`;
  const pwForm = el('div', { className: 'form-grid' });
  pwForm.innerHTML = `
    <div><label>Current Password</label><input id="pw_current" type="password"></div>
    <div><label>New Password</label><input id="pw_new" type="password"></div>
  `;
  pwPanel.appendChild(pwForm);
  const pwMsg = el('div', { style: 'font-size:12.5px;margin:8px 0;display:none;' });
  pwPanel.appendChild(pwMsg);
  const pwBtn = el('button', { className: 'btn' }, 'Update Password');
  pwBtn.onclick = async () => {
    const currentPassword = pwForm.querySelector('#pw_current').value;
    const newPassword = pwForm.querySelector('#pw_new').value;
    pwMsg.style.display = 'none';
    try {
      await api.changeAdminPassword(currentPassword, newPassword);
      pwMsg.style.color = 'var(--open)';
      pwMsg.textContent = 'Password updated. Use it next time you log in.';
      pwMsg.style.display = 'block';
      pwForm.querySelector('#pw_current').value = '';
      pwForm.querySelector('#pw_new').value = '';
    } catch (e) {
      pwMsg.style.color = 'var(--closed)';
      pwMsg.textContent = e.message;
      pwMsg.style.display = 'block';
    }
  };
  pwPanel.appendChild(pwBtn);
  root.appendChild(pwPanel);

  // ---- UPI payment details ----
  // Note: we deliberately do NOT auto-generate a QR code from the UPI ID.
  // Auto-generated "upi://pay" QR codes are often rejected/mis-scanned by
  // real UPI apps. Instead, the admin uploads a screenshot of their actual
  // working QR code (from GPay/PhonePe/Paytm/bank app) and that exact image
  // is shown to students — guaranteed to scan correctly since it's the real thing.
  const upiPanel = el('section', { className: 'panel' });
  upiPanel.innerHTML = `<h2>UPI Payment Details</h2><p class="sub">Upload a screenshot of your real UPI QR code — this exact image is shown to students when their fee is due, so it always scans correctly.</p>`;
  const upiForm = el('div', { className: 'form-grid' });
  upiForm.innerHTML = `
    <div><label>UPI ID (shown as text under the QR)</label><input id="upi_id" placeholder="e.g. yourlibrary@okhdfcbank" value="${settings.upiId || ''}"></div>
    <div><label>Payee Name</label><input id="upi_name" placeholder="e.g. Career Library" value="${settings.upiPayeeName || ''}"></div>
  `;
  upiPanel.appendChild(upiForm);

  const qrPreview = el('div', { className: 'qr-upload-box' });
  upiPanel.appendChild(qrPreview);

  function drawQr() {
    qrPreview.innerHTML = '';
    if (settings.upiQrImage) {
      qrPreview.innerHTML = `
        <img src="${settings.upiQrImage}" alt="UPI QR code" class="qr-image">
        <div>
          <p class="sub" style="margin:0 0 8px;">This is the exact QR image students will see and scan.</p>
          <button class="btn ghost" id="qr_remove">Remove QR Image</button>
        </div>
      `;
      qrPreview.querySelector('#qr_remove').onclick = async () => {
        if (!confirm('Remove the uploaded QR code? Students will no longer see a scannable QR until you upload a new one.')) return;
        await api.deleteQr();
        rerender();
      };
    } else {
      qrPreview.innerHTML = `<p class="empty">No QR code uploaded yet — students won't see a scannable QR until you add one.</p>`;
    }
  }
  drawQr();

  const qrUploadRow = el('div', { style: 'display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px;' });
  const qrFileInput = el('input', { type: 'file', id: 'qrFile', accept: 'image/*' });
  const qrUploadBtn = el('button', { className: 'btn' }, settings.upiQrImage ? 'Replace QR Image' : 'Upload QR Image');
  qrUploadBtn.onclick = async () => {
    const file = qrFileInput.files[0];
    if (!file) { alert('Choose a QR code screenshot first.'); return; }
    qrUploadBtn.disabled = true; qrUploadBtn.textContent = 'Uploading…';
    try {
      await api.uploadQr(file);
      rerender();
    } catch (e) {
      alert('Upload failed: ' + e.message);
      qrUploadBtn.disabled = false; qrUploadBtn.textContent = 'Upload QR Image';
    }
  };
  qrUploadRow.appendChild(qrFileInput);
  qrUploadRow.appendChild(qrUploadBtn);
  upiPanel.appendChild(qrUploadRow);

  const upiSaveBtn = el('button', { className: 'btn ghost', style: 'margin-top:14px;' }, 'Save UPI ID / Payee Name');
  upiSaveBtn.onclick = async () => {
    await api.updateSettings({
      upiId: upiForm.querySelector('#upi_id').value.trim(),
      upiPayeeName: upiForm.querySelector('#upi_name').value.trim()
    });
    alert('Saved!');
    rerender();
  };
  upiPanel.appendChild(upiSaveBtn);
  root.appendChild(upiPanel);
}
