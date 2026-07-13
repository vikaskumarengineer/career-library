import { api } from './api.js';
import { el, downloadAllStudentsPDF } from './ui.js';
import { EXAM_SYLLABUS } from './syllabus.js';

export async function renderStudents(root, { rerender }) {
  const [students, seats] = await Promise.all([api.getStudents(), api.getSeats()]);

  const panel = el('section', { className: 'panel' });
  panel.innerHTML = `<h2>Add Student (Admin)</h2><p class="sub">Register a student directly from the admin side. A Roll Number is generated automatically — give it to the student so they can sign in and set their own password from "My Account" (or set one for them below).</p>`;
  const form = el('div', { className: 'form-grid' });
  form.innerHTML = `
    <div><label>Name</label><input id="f_name" placeholder="Student's full name"></div>
    <div><label>Gender</label><select id="f_gender"><option>Boy</option><option>Girl</option></select></div>
    <div>
      <label>Exam Target</label>
      <select id="f_exam">${Object.keys(EXAM_SYLLABUS).map(k => `<option>${k}</option>`).join('')}<option value="__custom__">+ Custom (type below)</option></select>
      <input id="f_exam_custom" placeholder="e.g. Bank PO, CLAT, School Boards..." style="margin-top:8px;display:none;">
    </div>
    <div><label>Phone</label><input id="f_phone" placeholder="Mobile number"></div>
    <div><label>Fee Amount (₹/month)</label><input id="f_fee" type="number" placeholder="e.g. 800"></div>
    <div><label>Password (optional)</label><input id="f_password" type="password" placeholder="Leave blank — student sets it with their Roll Number"></div>
    <div><label>Daily Study Goal (hours)</label><input id="f_goal" type="number" step="0.5" placeholder="e.g. 3"></div>
  `;
  panel.appendChild(form);
  const examSelect = form.querySelector('#f_exam');
  const examCustom = form.querySelector('#f_exam_custom');
  examSelect.onchange = () => { examCustom.style.display = examSelect.value === '__custom__' ? 'block' : 'none'; };

  const addBtn = el('button', { className: 'btn' }, 'Add Student');
  addBtn.onclick = async () => {
    const name = form.querySelector('#f_name').value.trim();
    if (!name) return;
    let examTarget = examSelect.value;
    if (examTarget === '__custom__') {
      examTarget = examCustom.value.trim();
      if (!examTarget) { alert('Please type the exam/target name.'); return; }
    }
    await api.createStudent({
      name,
      gender: form.querySelector('#f_gender').value,
      examTarget,
      phone: form.querySelector('#f_phone').value.trim(),
      feeAmount: Number(form.querySelector('#f_fee').value) || 0,
      password: form.querySelector('#f_password').value.trim(),
      dailyGoalHours: Number(form.querySelector('#f_goal').value) || 3
    });
    rerender();
  };
  panel.appendChild(addBtn);
  root.appendChild(panel);

  const listPanel = el('section', { className: 'panel' });
  const listHead = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:6px;' });
  listHead.innerHTML = `<h2 style="margin:0;">All Students (${students.length})</h2>`;
  if (students.length > 0) {
    const pdfBtn = el('button', { className: 'btn ghost' }, '⬇ Download All Records (PDF)');
    pdfBtn.onclick = async () => {
      const settings = await api.getSettings();
      downloadAllStudentsPDF(students, seats, settings);
    };
    listHead.appendChild(pdfBtn);
  }
  listPanel.appendChild(listHead);
  if (students.length === 0) {
    listPanel.innerHTML += `<p class="empty">No students yet. Add one above, or share the "Create Account" tab so students can sign themselves up.</p>`;
  } else {
    const wrap = el('div', { className: 'table-scroll' });
    const table = el('table');
    table.innerHTML = `
      <thead><tr><th>Name</th><th>Roll</th><th>Gender</th><th>Target</th><th>Seat</th><th>Fee</th><th>Password</th><th></th></tr></thead>
      <tbody>
        ${students.map(s => {
          const seat = seats.find(se => se.occupantId === s.id);
          return `<tr>
            <td>${s.name}</td><td class="mono">${s.roll}</td><td>${s.gender}</td><td>${s.examTarget}</td>
            <td class="mono">${seat ? '#' + seat.seatNo : '—'}</td>
            <td><span class="pill ${s.feeStatus === 'paid' ? 'paid' : 'due'}">${s.feeStatus}</span></td>
            <td><span class="pill ${s.passwordSet ? 'paid' : 'due'}">${s.passwordSet ? 'Set' : 'Not set yet'}</span></td>
            <td><button class="btn ghost" data-del="${s.id}">Remove</button></td>
          </tr>`;
        }).join('')}
      </tbody>
    `;
    wrap.appendChild(table);
    listPanel.appendChild(wrap);
    listPanel.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = async () => { await api.deleteStudent(btn.getAttribute('data-del')); rerender(); };
    });
  }
  root.appendChild(listPanel);
}
