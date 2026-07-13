import { api } from './api.js';
import { el } from './ui.js';
import { EXAM_SYLLABUS } from './syllabus.js';
import { state } from './state.js';
import { renderAnnouncementBanner } from './announcementBanner.js';

export async function renderSignup(root, { goToTab }) {
  await renderAnnouncementBanner(root);

  const [seats] = await Promise.all([api.getSeats()]);

  const panel = el('section', { className: 'panel' });
  panel.innerHTML = `<h2>Create Your Student Account</h2><p class="sub">Fill in your details, choose a password, and pick your seat. Your seat is held for 2 hours until you first check in — after that it opens back up if unused.</p>`;

  const form = el('div', { className: 'form-grid' });
  form.innerHTML = `
    <div><label>Full Name</label><input id="su_name" placeholder="Your full name"></div>
    <div><label>Gender</label><select id="su_gender"><option>Boy</option><option>Girl</option></select></div>
    <div>
      <label>Exam Target</label>
      <select id="su_exam">${Object.keys(EXAM_SYLLABUS).map(k => `<option>${k}</option>`).join('')}<option value="__custom__">+ My own (type below)</option></select>
      <input id="su_exam_custom" placeholder="e.g. Bank PO, CLAT, School Boards..." style="margin-top:8px;display:none;">
    </div>
    <div><label>Phone</label><input id="su_phone" placeholder="Mobile number"></div>
    <div><label>Monthly Fee (₹)</label><input id="su_fee" type="number" placeholder="e.g. 800"></div>
    <div><label>Choose a Password</label><input id="su_password" type="password" placeholder="At least 4 characters"></div>
    <div><label>Preferred Shift</label><select id="su_shift"><option>Full Day</option><option>Morning</option><option>Evening</option></select></div>
    <div><label>Daily Study Goal (hours)</label><input id="su_goal" type="number" step="0.5" placeholder="e.g. 3"></div>
  `;
  panel.appendChild(form);

  const examSelect = form.querySelector('#su_exam');
  const examCustom = form.querySelector('#su_exam_custom');
  examSelect.onchange = () => {
    examCustom.style.display = examSelect.value === '__custom__' ? 'block' : 'none';
  };

  const seatWrap = el('div');
  seatWrap.innerHTML = `<h3 style="font-size:14px;margin-top:6px;">Pick an open seat (optional)</h3>`;
  const grid = el('div', { className: 'seat-map' });
  seats.forEach(seat => {
    const isTaken = !!seat.occupantId;
    const div = el('div', { className: 'seat ' + (isTaken ? 'closed disabled' : (state.signupSelectedSeat === seat.seatNo ? 'selected' : 'open')) });
    div.innerHTML = `<div class="no mono">#${seat.seatNo}</div><div class="who">${isTaken ? 'Taken' : (state.signupSelectedSeat === seat.seatNo ? 'Selected' : 'Open')}</div>`;
    if (!isTaken) {
      div.onclick = () => {
        state.signupSelectedSeat = (state.signupSelectedSeat === seat.seatNo) ? null : seat.seatNo;
        root.innerHTML = '';
        renderSignup(root, { goToTab });
      };
    }
    grid.appendChild(div);
  });
  seatWrap.appendChild(grid);
  panel.appendChild(seatWrap);

  const submitBtn = el('button', { className: 'btn', style: 'margin-top:16px;' }, 'Create Account');
  submitBtn.onclick = async () => {
    const name = form.querySelector('#su_name').value.trim();
    const password = form.querySelector('#su_password').value.trim();
    if (!name) { alert('Please enter your name.'); return; }
    if (password.length < 4) { alert('Password must be at least 4 characters.'); return; }

    let examTarget = form.querySelector('#su_exam').value;
    if (examTarget === '__custom__') {
      examTarget = form.querySelector('#su_exam_custom').value.trim();
      if (!examTarget) { alert('Please type your exam/target name.'); return; }
    }

    const student = await api.createStudent({
      name,
      gender: form.querySelector('#su_gender').value,
      examTarget,
      phone: form.querySelector('#su_phone').value.trim(),
      feeAmount: Number(form.querySelector('#su_fee').value) || 0,
      password,
      dailyGoalHours: Number(form.querySelector('#su_goal').value) || 3,
      seatNo: state.signupSelectedSeat,
      shift: form.querySelector('#su_shift').value
    });

    const chosenSeat = state.signupSelectedSeat;
    state.signupSelectedSeat = null;

    root.innerHTML = '';
    const confirmPanel = el('section', { className: 'panel' });
    confirmPanel.innerHTML = `
      <h2>Account Created!</h2>
      <p class="sub">Save your Roll Number — you'll need it, along with the password you just chose, to log in from "My Account".</p>
      <div class="credential-box">
        <div>Roll Number<br><span class="big">${student.roll}</span></div>
      </div>
      <p class="sub" style="margin-top:12px;">Seat: ${chosenSeat ? '#' + chosenSeat + ' — held for 2h until your first check-in' : 'Not assigned yet — pick one later, or ask the admin.'}</p>
      <button class="btn" id="goToLogin" style="margin-top:10px;">Go to My Account</button>
    `;
    root.appendChild(confirmPanel);
    confirmPanel.querySelector('#goToLogin').onclick = () => goToTab('mystudy');
  };
  panel.appendChild(submitBtn);
  root.appendChild(panel);
}
