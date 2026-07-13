import { api } from './api.js';
import { el } from './ui.js';

let bannerTimer = null;

export async function renderHome(root, { goToTab } = {}) {
  const [settings, announcements] = await Promise.all([
    api.getSettings(), api.getAnnouncements()
  ]);

  // ---- Hero: rotating photo banner + name/address ----
  const heroPanel = el('section', { className: 'panel' });
  const photos = Array.isArray(settings.photos) && settings.photos.length
    ? settings.photos
    : (settings.photoUrl ? [settings.photoUrl] : []);

  if (bannerTimer) { clearInterval(bannerTimer); bannerTimer = null; }

  if (photos.length === 0) {
    const photoBox = el('div', { className: 'photo-box', style: 'margin-bottom:16px;' });
    photoBox.innerHTML = `<div class="photo-placeholder">No photo uploaded yet — an admin can add one from Settings.</div>`;
    heroPanel.appendChild(photoBox);
  } else {
    const banner = el('div', { className: 'photo-banner' });
    photos.forEach((url, i) => {
      const slide = el('img', { className: 'banner-slide' + (i === 0 ? ' active' : ''), src: url, alt: settings.libraryName });
      banner.appendChild(slide);
    });
    if (photos.length > 1) {
      const dots = el('div', { className: 'banner-dots' });
      photos.forEach((_, i) => dots.appendChild(el('span', { className: 'banner-dot' + (i === 0 ? ' active' : '') })));
      banner.appendChild(dots);
    }
    heroPanel.appendChild(banner);

    if (photos.length > 1) {
      let current = 0;
      const slides = banner.querySelectorAll('.banner-slide');
      const dotEls = banner.querySelectorAll('.banner-dot');
      bannerTimer = setInterval(() => {
        slides[current].classList.remove('active');
        dotEls[current].classList.remove('active');
        current = (current + 1) % slides.length;
        slides[current].classList.add('active');
        dotEls[current].classList.add('active');
      }, 4000);
    }
  }

  const heroText = el('div');
  heroText.innerHTML = `<h2>${settings.libraryName}</h2><p class="sub">${settings.address || ''}</p>
    ${settings.adminPhone ? `<p class="sub">📞 Contact: <a href="tel:${settings.adminPhone}">${settings.adminPhone}</a></p>` : ''}`;
  heroPanel.appendChild(heroText);
  const heroBtnRow = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;' });
  if (photos.length > 0 && goToTab) {
    const galleryBtn = el('button', { className: 'btn ghost' }, '📷 View Full Gallery');
    galleryBtn.onclick = () => goToTab('gallery');
    heroBtnRow.appendChild(galleryBtn);
  }
  if (goToTab) {
    const locationBtn = el('button', { className: 'btn ghost' }, '📍 Find Us');
    locationBtn.onclick = () => goToTab('location');
    heroBtnRow.appendChild(locationBtn);
  }
  if (heroBtnRow.children.length) heroPanel.appendChild(heroBtnRow);
  root.appendChild(heroPanel);

  // ---- Announcements (read-only) ----
  const annPanel = el('section', { className: 'panel' });
  annPanel.innerHTML = `<h2>Announcements</h2>`;
  const annList = el('div');
  if (announcements.length === 0) annList.innerHTML = '<p class="empty">No announcements yet.</p>';
  else announcements.slice().reverse().slice(0, 6).forEach(a => {
    annList.appendChild(el('div', { className: 'ann-item' }, `${a.text}<div class="ann-date">${a.date}</div>`));
  });
  annPanel.appendChild(annList);
  root.appendChild(annPanel);

  // ---- Interested in joining? (public lead form, no login needed) ----
  const joinPanel = el('section', { className: 'panel' });
  joinPanel.innerHTML = `<h2>Interested in Joining?</h2><p class="sub">Leave your details and we'll get in touch about seats, fees, and timings.</p>`;
  const joinForm = el('div', { className: 'form-grid' });
  joinForm.innerHTML = `
    <div><label>Full Name</label><input id="join_name" placeholder="Your full name"></div>
    <div><label>Phone</label><input id="join_phone" placeholder="Mobile number"></div>
    <div><label>Exam You're Preparing For</label><input id="join_exam" placeholder="e.g. UPSC, SSC, Bank PO..."></div>
    <div style="grid-column:1/-1;"><label>Message (optional)</label><input id="join_msg" placeholder="Anything you'd like to ask"></div>
  `;
  joinPanel.appendChild(joinForm);
  const joinMsgBox = el('div', { style: 'font-size:12.5px;margin:8px 0;display:none;' });
  joinPanel.appendChild(joinMsgBox);
  const joinBtn = el('button', { className: 'btn' }, 'Submit Enquiry');
  joinBtn.onclick = async () => {
    const name = joinForm.querySelector('#join_name').value.trim();
    const phone = joinForm.querySelector('#join_phone').value.trim();
    if (!name) { alert('Please enter your name.'); return; }
    if (!phone) { alert('Please enter your phone number.'); return; }
    joinBtn.disabled = true; joinBtn.textContent = 'Submitting…';
    try {
      await api.submitEnquiry({
        name, phone,
        examTarget: joinForm.querySelector('#join_exam').value.trim(),
        message: joinForm.querySelector('#join_msg').value.trim()
      });
      joinForm.innerHTML = '';
      joinMsgBox.style.color = 'var(--open)';
      joinMsgBox.textContent = "Thanks! We've got your details and will reach out soon.";
      joinMsgBox.style.display = 'block';
      joinBtn.style.display = 'none';
    } catch (e) {
      joinMsgBox.style.color = 'var(--closed)';
      joinMsgBox.textContent = e.message;
      joinMsgBox.style.display = 'block';
      joinBtn.disabled = false; joinBtn.textContent = 'Submit Enquiry';
    }
  };
  joinPanel.appendChild(joinBtn);
  root.appendChild(joinPanel);
}
