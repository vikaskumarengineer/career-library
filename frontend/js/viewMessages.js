import { api } from './api.js';
import { el } from './ui.js';

export async function renderMessages(root, { rerender }) {
  const [queries, enquiries, notifications, students] = await Promise.all([
    api.getQueries(), api.getEnquiries(), api.getNotifications(), api.getStudents()
  ]);

  // ---- Send a notification to one specific student (e.g. "Vikas, please pay fee") ----
  const notePanel = el('section', { className: 'panel' });
  notePanel.innerHTML = `<h2>Notify a Student</h2><p class="sub">Send a message to one specific student — it shows up on their My Account page until they've seen it.</p>`;
  const noteForm = el('div', { className: 'form-grid' });
  noteForm.innerHTML = `
    <div>
      <label>Student</label>
      <select id="note_student">
        <option value="">Select a student…</option>
        ${students.map(s => `<option value="${s.id}">${s.name} (${s.roll})</option>`).join('')}
      </select>
    </div>
    <div><label>Message</label><input id="note_text" placeholder="e.g. Please pay your pending fee"></div>
  `;
  notePanel.appendChild(noteForm);
  const noteQuick = el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;' });
  ['Please pay your pending fee', 'Please bring your ID card tomorrow', 'Please meet the admin at the desk'].forEach(t => {
    const chip = el('button', { className: 'btn ghost', style: 'font-size:11px;padding:6px 10px;min-height:auto;' }, t);
    chip.onclick = () => { noteForm.querySelector('#note_text').value = t; };
    noteQuick.appendChild(chip);
  });
  notePanel.appendChild(noteQuick);
  const noteBtn = el('button', { className: 'btn' }, 'Send Notification');
  noteBtn.onclick = async () => {
    const studentId = noteForm.querySelector('#note_student').value;
    const text = noteForm.querySelector('#note_text').value.trim();
    if (!studentId) { alert('Choose a student first.'); return; }
    if (!text) { alert('Type a message first.'); return; }
    const student = students.find(s => s.id === studentId);
    noteBtn.disabled = true; noteBtn.textContent = 'Sending…';
    try {
      await api.sendNotification(studentId, student ? student.name : '', text);
      rerender();
    } catch (e) {
      alert(e.message);
      noteBtn.disabled = false; noteBtn.textContent = 'Send Notification';
    }
  };
  notePanel.appendChild(noteBtn);

  if (notifications.length > 0) {
    const noteList = el('div', { style: 'margin-top:16px;' });
    noteList.appendChild(el('h3', { style: 'font-size:13px;margin-bottom:6px;' }, 'Sent Notifications'));
    notifications.slice().reverse().forEach(n => {
      const div = el('div', { style: 'border-bottom:1px solid var(--line);padding:10px 0;' });
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div><strong>${n.studentName || 'Student'}</strong> <span class="sub" style="margin:0;">${n.date}</span>${n.auto ? ' <span class="pill pending" style="font-size:10px;">Auto</span>' : ''}</div>
          <span class="pill ${n.read ? 'resolved' : 'pending'}">${n.read ? 'Seen' : 'Unseen'}</span>
        </div>
        <p style="margin:6px 0;font-size:13px;">${n.text}</p>
        <button class="btn ghost" data-note-del="${n.id}" style="font-size:11px;padding:6px 10px;min-height:auto;">Remove</button>
      `;
      noteList.appendChild(div);
    });
    notePanel.appendChild(noteList);
  }
  root.appendChild(notePanel);
  notePanel.querySelectorAll('[data-note-del]').forEach(btn => {
    btn.onclick = async () => { await api.deleteNotification(btn.getAttribute('data-note-del')); rerender(); };
  });

  // ---- Join enquiries (from the public Home page form) ----
  const enqPanel = el('section', { className: 'panel' });
  enqPanel.innerHTML = `<h2>Join Enquiries</h2><p class="sub">People interested in joining, from the Home page form.</p>`;
  if (enquiries.length === 0) {
    enqPanel.innerHTML += `<p class="empty">No enquiries yet.</p>`;
  } else {
    enquiries.slice().reverse().forEach(e => {
      const div = el('div', { style: 'border-bottom:1px solid var(--line);padding:10px 0;' });
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div><strong>${e.name}</strong> <span class="sub" style="margin:0;">${e.date}</span></div>
          <span class="pill ${e.contacted ? 'resolved' : 'pending'}">${e.contacted ? 'Contacted' : 'New'}</span>
        </div>
        <p style="margin:6px 0;font-size:13px;">📞 ${e.phone}${e.examTarget ? ' · 🎯 ' + e.examTarget : ''}</p>
        ${e.message ? `<p style="margin:6px 0;font-size:13px;color:var(--ink-dim);">"${e.message}"</p>` : ''}
        <button class="btn ghost" data-contacted="${e.id}" style="font-size:11px;padding:6px 10px;min-height:auto;">${e.contacted ? 'Mark Not Contacted' : 'Mark Contacted'}</button>
      `;
      enqPanel.appendChild(div);
    });
  }
  root.appendChild(enqPanel);
  enqPanel.querySelectorAll('[data-contacted]').forEach(btn => {
    btn.onclick = async () => { await api.toggleEnquiryContacted(btn.getAttribute('data-contacted')); rerender(); };
  });

  // ---- Student queries ----
  const panel = el('section', { className: 'panel' });
  panel.innerHTML = `<h2>Student Queries</h2><p class="sub">Messages students sent from their My Account page.</p>`;
  if (queries.length === 0) {
    panel.innerHTML += `<p class="empty">No messages yet.</p>`;
  } else {
    queries.slice().reverse().forEach(q => {
      const div = el('div', { style: 'border-bottom:1px solid var(--line);padding:10px 0;' });
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div><strong>${q.studentName}</strong> <span class="sub" style="margin:0;">${q.date}</span></div>
          <span class="pill ${q.resolved ? 'resolved' : 'pending'}">${q.resolved ? 'Resolved' : 'Pending'}</span>
        </div>
        <p style="margin:6px 0;font-size:13px;">${q.text}</p>
        <button class="btn ghost" data-resolve="${q.id}" style="font-size:11px;padding:6px 10px;min-height:auto;">${q.resolved ? 'Mark Pending' : 'Mark Resolved'}</button>
      `;
      panel.appendChild(div);
    });
  }
  root.appendChild(panel);
  panel.querySelectorAll('[data-resolve]').forEach(btn => {
    btn.onclick = async () => { await api.resolveQuery(btn.getAttribute('data-resolve')); rerender(); };
  });
}
