import { api } from './api.js';
import { el } from './ui.js';

let revealObserver = null;

export async function renderGallery(root) {
  const settings = await api.getSettings();
  const photos = Array.isArray(settings.photos) && settings.photos.length
    ? settings.photos
    : (settings.photoUrl ? [settings.photoUrl] : []);

  const panel = el('section', { className: 'panel' });
  panel.innerHTML = `<h2>Photo Gallery</h2><p class="sub">A look inside ${settings.libraryName || 'the library'} — its reading rooms, seating, and facilities. Tap any photo to zoom in.</p>`;

  if (photos.length === 0) {
    panel.appendChild(el('div', { className: 'photo-placeholder' }, 'No photos uploaded yet. An admin can add some from the Settings tab.'));
    root.appendChild(panel);
    return;
  }

  const grid = el('div', { className: 'masonry-gallery' });
  photos.forEach((url, i) => {
    const item = el('div', { className: 'masonry-item' });
    item.innerHTML = `<img src="${url}" alt="Library photo ${i + 1}" loading="lazy">`;
    item.onclick = (e) => openLightbox(photos, i, e.clientX, e.clientY);
    grid.appendChild(item);
  });
  panel.appendChild(grid);
  root.appendChild(panel);

  // Reveal each photo with a fade/slide-up as the student scrolls down to it
  if (revealObserver) revealObserver.disconnect();
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  grid.querySelectorAll('.masonry-item').forEach(node => revealObserver.observe(node));
}

function openLightbox(photos, startIndex, clickX, clickY) {
  let index = startIndex;

  // Zoom the image in from roughly where the student tapped, rather than
  // just popping the lightbox open instantly.
  const originX = clickX ? (clickX / window.innerWidth) * 100 : 50;
  const originY = clickY ? (clickY / window.innerHeight) * 100 : 50;

  const overlay = el('div', { className: 'overlay lightbox-overlay' });
  overlay.innerHTML = `
    <div class="lightbox">
      <img class="lightbox-img" src="${photos[index]}" alt="Library photo" style="transform-origin:${originX}% ${originY}%;transform:scale(.15);opacity:0;">
      <div class="lightbox-controls">
        <button class="close lightbox-close">&times;</button>
        <button class="lightbox-nav lightbox-prev" aria-label="Previous photo">&#10094;</button>
        <button class="lightbox-nav lightbox-next" aria-label="Next photo">&#10095;</button>
        <div class="lightbox-count mono">${index + 1} / ${photos.length}</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const imgEl = overlay.querySelector('.lightbox-img');
  const countEl = overlay.querySelector('.lightbox-count');

  // force layout, then trigger the zoom-in transition
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.classList.add('shown');
      imgEl.style.transform = 'scale(1)';
      imgEl.style.opacity = '1';
    });
  });

  function show(i) {
    index = (i + photos.length) % photos.length;
    imgEl.style.opacity = '0';
    setTimeout(() => {
      imgEl.src = photos[index];
      imgEl.style.opacity = '1';
      countEl.textContent = `${index + 1} / ${photos.length}`;
    }, 180);
  }

  function close() {
    overlay.classList.remove('shown');
    imgEl.style.transform = 'scale(.15)';
    imgEl.style.opacity = '0';
    setTimeout(() => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      overlay.remove();
    }, 320);
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') show(index + 1);
    if (e.key === 'ArrowLeft') show(index - 1);
  }

  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  overlay.querySelector('.lightbox-close').onclick = close;
  overlay.querySelector('.lightbox-prev').onclick = () => show(index - 1);
  overlay.querySelector('.lightbox-next').onclick = () => show(index + 1);
  document.addEventListener('keydown', onKey);
}

