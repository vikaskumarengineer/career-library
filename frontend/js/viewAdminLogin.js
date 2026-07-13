import { api } from './api.js';
import { el } from './ui.js';
import { state } from './state.js';

export function renderAdminLogin(root, onSuccess) {
  const panel = el('section', { className: 'panel' });
  panel.style.maxWidth = '360px';
  panel.style.margin = '40px auto';
  panel.innerHTML = `
    <h2>Admin Login</h2>
    <p class="sub">This section is for library staff only. Enter the admin password to continue.</p>
    <label>Password</label>
    <input id="adminPassInput" type="password" style="margin-bottom:12px;" placeholder="Admin password">
    <div id="adminLoginErr" style="color:var(--closed);font-size:12px;margin-bottom:10px;display:none;"></div>
    <button class="btn" id="adminLoginBtn" style="width:100%;">Login</button>
  `;
  root.appendChild(panel);

  const doLogin = async () => {
    const password = panel.querySelector('#adminPassInput').value;
    try {
      await api.adminLogin(password);
      state.adminAuthed = true;
      onSuccess();
    } catch (e) {
      const errBox = panel.querySelector('#adminLoginErr');
      // "Failed to fetch" means the browser couldn't reach the backend at all
      // (server not running, wrong port, or opened index.html directly instead
      // of via http://localhost:4000) — that's a different problem than a
      // wrong password, so tell the user which one it actually is.
      if (e.message && e.message.toLowerCase().includes('fetch')) {
        errBox.textContent = 'Cannot reach the server. Make sure the backend is running (npm start in the backend folder) and that you opened the site at http://localhost:4000, not the file directly.';
      } else {
        errBox.textContent = e.message || 'Incorrect password. Please try again.';
      }
      errBox.style.display = 'block';
    }
  };
  panel.querySelector('#adminLoginBtn').onclick = doLogin;
  panel.querySelector('#adminPassInput').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
}
