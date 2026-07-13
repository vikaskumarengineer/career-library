import { state, TABS, ADMIN_TABS } from './state.js';
import { el } from './ui.js';
import { renderAdminLogin } from './viewAdminLogin.js';
import { renderHome } from './viewHome.js';
import { renderLocation } from './viewLocation.js';
import { renderGallery } from './viewGallery.js';
import { api } from './api.js';
import { renderDashboard } from './viewDashboard.js';
import { renderStudents } from './viewStudents.js';
import { renderAttendance } from './viewAttendance.js';
import { renderFees } from './viewFees.js';
import { renderTimetable } from './viewTimetable.js';
import { renderReports } from './viewReports.js';
import { renderMessages } from './viewMessages.js';
import { renderSettings } from './viewSettings.js';
import { renderSignup } from './viewSignup.js';
import { renderMyAccount } from './viewMyAccount.js';
import { renderLeaderboard } from './viewLeaderboard.js';
import { openSeatTicket } from './seatTicket.js';

function closeAllDropdowns() {
  document.querySelectorAll('#tabs .nav-item.open').forEach(n => n.classList.remove('open'));
}

function renderTabs() {
  const nav = document.getElementById('tabs');
  nav.innerHTML = '';

  TABS.forEach(t => {
    if (t.id) {
      // simple top-level link, e.g. Home / Dashboard
      const item = el('div', { className: 'nav-item' });
      const b = el('button', {}, t.label);
      b.className = t.id === state.currentTab ? 'active' : '';
      b.onclick = () => { state.currentTab = t.id; render(); };
      item.appendChild(b);
      nav.appendChild(item);
      return;
    }

    // dropdown group, e.g. Manage / Office / Student
    const isActiveGroup = t.children.some(c => c.id === state.currentTab);
    const item = el('div', { className: 'nav-item' });
    const toggle = el('button', { className: isActiveGroup ? 'active' : '' }, `${t.label} <span class="caret">▾</span>`);
    toggle.onclick = (e) => {
      e.stopPropagation();
      const wasOpen = item.classList.contains('open');
      closeAllDropdowns();
      if (!wasOpen) item.classList.add('open');
    };
    item.appendChild(toggle);

    const dropdown = el('div', { className: 'nav-dropdown' });
    t.children.forEach(c => {
      const cb = el('button', { className: c.id === state.currentTab ? 'active' : '' }, c.label);
      cb.onclick = () => { state.currentTab = c.id; closeAllDropdowns(); render(); };
      dropdown.appendChild(cb);
    });
    item.appendChild(dropdown);
    nav.appendChild(item);
  });
}

async function render() {
  renderTabs();
  syncBranding();
  const root = document.getElementById('app');
  root.innerHTML = '';

  const logoutBtn = document.getElementById('adminLogoutBtn');
  logoutBtn.style.display = state.adminAuthed ? 'inline-block' : 'none';
  logoutBtn.onclick = () => { state.adminAuthed = false; state.currentTab = 'dashboard'; render(); };

  if (ADMIN_TABS.includes(state.currentTab) && !state.adminAuthed) {
    renderAdminLogin(root, render);
    return;
  }

  const helpers = { rerender: render, goToTab: (id) => { state.currentTab = id; render(); }, openSeatTicket: (n) => openSeatTicket(n, { rerender: render }) };

  try {
    if (state.currentTab === 'home') await renderHome(root, helpers);
    else if (state.currentTab === 'location') await renderLocation(root);
    else if (state.currentTab === 'gallery') await renderGallery(root);
    else if (state.currentTab === 'dashboard') await renderDashboard(root, helpers);
    else if (state.currentTab === 'students') await renderStudents(root, helpers);
    else if (state.currentTab === 'attendance') await renderAttendance(root, helpers);
    else if (state.currentTab === 'fees') await renderFees(root, helpers);
    else if (state.currentTab === 'timetable') await renderTimetable(root, helpers);
    else if (state.currentTab === 'reports') await renderReports(root, helpers);
    else if (state.currentTab === 'messages') await renderMessages(root, helpers);
    else if (state.currentTab === 'settings') await renderSettings(root, helpers);
    else if (state.currentTab === 'signup') await renderSignup(root, helpers);
    else if (state.currentTab === 'mystudy') await renderMyAccount(root, helpers);
    else if (state.currentTab === 'leaderboard') await renderLeaderboard(root, helpers);
  } catch (e) {
    root.innerHTML = `<section class="panel"><h2>Something went wrong</h2><p class="sub">${e.message}. Is the backend server running?</p></section>`;
    console.error(e);
  }
}

function tickClock() {
  document.getElementById('clock').textContent = new Date().toLocaleString('en-IN', { weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

async function syncBranding() {
  try {
    const settings = await api.getSettings();
    if (settings.libraryName) {
      document.title = settings.libraryName + ' — Reading Room Manager';
      const h1 = document.querySelector('.brand h1');
      if (h1) h1.textContent = settings.libraryName;
      // The header now uses a real uploaded logo image (frontend/assets/logo.png),
      // set directly in index.html, so we no longer overwrite it with text initials.
    }
    const contactBtn = document.getElementById('adminContactBtn');
    if (contactBtn) {
      if (settings.adminPhone) {
        contactBtn.href = 'tel:' + settings.adminPhone;
        contactBtn.textContent = '📞 ' + settings.adminPhone;
        contactBtn.style.display = 'inline-block';
      } else {
        contactBtn.style.display = 'none';
      }
    }
  } catch (e) {
    // backend not reachable yet — header just keeps its default text
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = theme === 'light' ? '☾ Dark Mode' : '☀ Light Mode';
  localStorage.setItem('theme', theme);
}

function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);
  document.getElementById('themeToggleBtn').onclick = () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'light' ? 'dark' : 'light');
  };
}

(function init() {
  tickClock();
  setInterval(tickClock, 1000);
  document.addEventListener('click', closeAllDropdowns);
  initTheme();
  syncBranding();
  render();
})();
