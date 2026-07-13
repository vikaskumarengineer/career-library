import { api } from './api.js';
import { el, fmtTime, TODAY, computeStreak, weeklyHours, subjectTotals, barChart, distributionBars, monthLabel, downloadFeeReceipt } from './ui.js';
import { EXAM_SYLLABUS } from './syllabus.js';
import { state } from './state.js';
import { renderAnnouncementBanner } from './announcementBanner.js';

export async function renderMyAccount(root, { rerender }) {
  if (!state.studentSession) {
    await renderAnnouncementBanner(root);
    renderLoginForm(root, rerender);
    return;
  }

  const student = state.studentSession;

  const topBar = el('div', { style: 'display:flex;justify-content:flex-end;margin-bottom:6px;' });
  const logoutBtn = el('button', { className: 'btn ghost', style: 'font-size:11px;min-height:auto;padding:6px 10px;' }, 'Log Out');
  logoutBtn.onclick = () => { state.studentSession = null; rerender(); };
  topBar.appendChild(logoutBtn);
  root.appendChild(topBar);

  await renderAnnouncementBanner(root);

  const settings = await api.getSettings();
  const currentMonthKey = TODAY.slice(0, 7);

  // ---- Personal notifications from the admin (e.g. "please pay your fee") ----
  const myNotifications = await api.getStudentNotifications(student.id);
  const unread = myNotifications.filter(n => !n.read);
  if (myNotifications.length > 0) {
    const notePanel = el('section', { className: 'panel' });
    notePanel.innerHTML = `<h2>Notifications ${unread.length ? `<span class="pill pending" style="font-size:11px;vertical-align:middle;">${unread.length} new</span>` : ''}</h2>`;
    myNotifications.slice().reverse().forEach(n => {
      const row = el('div', { className: 'banner ' + (n.read ? '' : 'danger'), style: n.read ? 'background:var(--bg-panel-2);' : 'margin-bottom:8px;' });
      row.innerHTML = `${n.text}<div class="ann-date" style="margin-top:4px;">${n.date}</div>`;
      if (!n.read) {
        const dismissBtn = el('button', { className: 'btn ghost', style: 'font-size:11px;padding:6px 10px;min-height:auto;margin-top:8px;' }, 'Mark as Seen');
        dismissBtn.onclick = async () => { await api.markNotificationRead(n.id); rerender(); };
        row.appendChild(dismissBtn);
      }
      notePanel.appendChild(row);
    });
    root.appendChild(notePanel);
  }

  if (student.feeStatus === 'claimed') {
    root.appendChild(el('div', { className: 'banner warn' },
      `⏳ We've told the admin you paid ₹${student.feeAmount || 0} — they'll verify it in their bank/UPI app and confirm it shortly. Your receipt will appear here once confirmed.`));
  } else if (student.feeStatus === 'due') {
    const banner = el('div', { className: 'banner danger' });
    banner.innerHTML = `⚠ Your fee of ₹${student.feeAmount || 0} is due. Please pay at the front desk${settings.upiQrImage ? ', or scan below to pay via UPI:' : (settings.adminPhone ? `, or contact admin at ${settings.adminPhone}.` : '.')}`;
    root.appendChild(banner);
    if (settings.upiQrImage) {
      const qrWrap = el('div', { className: 'qr-upload-box', style: 'margin:10px 0 10px;' });
      qrWrap.innerHTML = `
        <img src="${settings.upiQrImage}" alt="Scan to pay via UPI" class="qr-image">
        <div>
          <p class="sub" style="margin:0;">Pay ₹${student.feeAmount || 0} to ${settings.upiPayeeName || settings.libraryName} via any UPI app.</p>
          ${settings.upiId ? `<p class="sub mono" style="margin:6px 0 0;">${settings.upiId}</p>` : ''}
          ${settings.adminPhone ? `<p class="sub" style="margin:6px 0 0;">Trouble scanning? Call admin: <a href="tel:${settings.adminPhone}">${settings.adminPhone}</a></p>` : ''}
        </div>
      `;
      root.appendChild(qrWrap);
      const paidBtn = el('button', { className: 'btn', style: 'margin-bottom:18px;' }, "I've Paid — Notify Admin");
      paidBtn.onclick = async () => {
        paidBtn.disabled = true; paidBtn.textContent = 'Notifying…';
        try {
          const updated = await api.claimPayment(student.id, currentMonthKey);
          state.studentSession = updated;
          rerender();
        } catch (e) {
          alert(e.message);
          paidBtn.disabled = false; paidBtn.textContent = "I've Paid — Notify Admin";
        }
      };
      root.appendChild(paidBtn);
    }
  }

  const seats = await api.getSeats();
  const seat = seats.find(se => se.occupantId === student.id);

  const profile = el('section', { className: 'panel' });
  profile.innerHTML = `
    <h2>${student.name}</h2>
    <p class="sub">${student.roll} · ${student.examTarget} · ${student.gender}</p>
    <div class="stat-grid">
      <div class="stat"><div class="num mono">${seat ? '#' + seat.seatNo : '—'}</div><div class="lbl">My Seat${seat && seat.shift ? ' (' + seat.shift + ')' : ''}</div></div>
      <div class="stat ${student.feeStatus === 'paid' ? 'open' : (student.feeStatus === 'claimed' ? 'warn' : 'closed')}"><div class="num" style="font-size:16px;">${student.feeStatus === 'paid' ? 'Paid' : (student.feeStatus === 'claimed' ? 'Pending' : 'Due')}</div><div class="lbl">Fee Status</div></div>
    </div>
    ${seat && seat.holdUntil ? `<p class="sub" style="color:var(--amber);margin-top:10px;">Your seat is held until ${new Date(seat.holdUntil).toLocaleString('en-IN')} — check in before then or it will be released.</p>` : ''}
    ${settings.adminPhone ? `<p class="sub" style="margin-top:10px;">Need help? Call admin: <a href="tel:${settings.adminPhone}">${settings.adminPhone}</a></p>` : ''}
  `;
  root.appendChild(profile);

  // ---- Payment history ----
  const feeHistory = student.feeHistory || {};
  const feeMonths = Object.keys(feeHistory).sort().reverse();
  if (feeMonths.length > 0) {
    const payPanel = el('section', { className: 'panel' });
    payPanel.innerHTML = `<h2>Payment History</h2>`;
    feeMonths.forEach(key => {
      const entry = feeHistory[key];
      const row = el('div', { className: 'fee-month-row' });
      row.innerHTML = `
        <span class="fee-month-label">${monthLabel(key)}</span>
        <span class="mono">₹${entry.amount}</span>
        <span class="pill ${entry.status === 'paid' ? 'paid' : (entry.status === 'claimed' ? 'pending' : 'due')}">${entry.status === 'claimed' ? 'pending review' : entry.status}</span>
        <span class="sub" style="margin:0;font-size:11px;min-width:110px;">${entry.paidDate ? 'Paid ' + entry.paidDate : (entry.status === 'claimed' ? 'Awaiting admin confirmation' : '')}</span>
        ${entry.status === 'paid' ? `<button class="btn ghost" data-receipt="${key}" style="font-size:11px;padding:6px 10px;min-height:auto;">Download Receipt</button>` : ''}
      `;
      payPanel.appendChild(row);
    });
    root.appendChild(payPanel);
    payPanel.querySelectorAll('[data-receipt]').forEach(btn => {
      btn.onclick = () => downloadFeeReceipt(student, btn.getAttribute('data-receipt'), feeHistory[btn.getAttribute('data-receipt')], settings);
    });
  }

  // ---- Self attendance ----
  const attendanceToday = await api.getAttendance(TODAY);
  const rec = attendanceToday[student.id] || {};
  const status = rec.checkIn && !rec.checkOut ? 'in' : 'out';
  const attPanel = el('section', { className: 'panel' });
  attPanel.innerHTML = `
    <h2>Today's Attendance</h2>
    <p class="sub">Check in when you arrive, check out when you leave.</p>
    <p><span class="pill ${status}">${status === 'in' ? 'Currently in library' : 'Not checked in'}</span>
    ${rec.checkIn ? ' · In: <span class="mono">' + fmtTime(rec.checkIn) + '</span>' : ''}
    ${rec.checkOut ? ' · Out: <span class="mono">' + fmtTime(rec.checkOut) + '</span>' : ''}</p>
    <div class="row-actions" style="margin-top:10px;">
      <button class="btn" id="selfIn" ${rec.checkIn && !rec.checkOut ? 'disabled' : ''}>Check-in</button>
      <button class="btn ghost" id="selfOut" ${!rec.checkIn || rec.checkOut ? 'disabled' : ''}>Check-out</button>
    </div>
  `;
  root.appendChild(attPanel);
  attPanel.querySelector('#selfIn').onclick = async () => { await api.checkIn(TODAY, student.id); rerender(); };
  attPanel.querySelector('#selfOut').onclick = async () => { await api.checkOut(TODAY, student.id); rerender(); };

  // ---- Today's study + goal reminder ----
  const data = await api.getStudy(student.id);
  const todayLogs = data.logs.filter(l => l.date === TODAY);
  const totalHoursToday = todayLogs.reduce((a, l) => a + Number(l.hours), 0);
  const goal = student.dailyGoalHours || 3;

  const summary = el('section', { className: 'panel' });
  summary.innerHTML = `<h2>Today's Study</h2>
    <div class="stat-grid">
      <div class="stat open"><div class="num">${totalHoursToday.toFixed(1)}h</div><div class="lbl">Hours today</div></div>
      <div class="stat"><div class="num">${goal}h</div><div class="lbl">Daily goal</div></div>
    </div>
  `;
  const goalBanner = el('div', { className: 'banner ' + (totalHoursToday >= goal ? 'good' : 'warn') },
    totalHoursToday >= goal
      ? `🎉 Goal reached! You've studied ${totalHoursToday.toFixed(1)}h of your ${goal}h goal today.`
      : `You've studied ${totalHoursToday.toFixed(1)}h of your ${goal}h goal today — ${(goal - totalHoursToday).toFixed(1)}h to go.`);
  summary.appendChild(goalBanner);
  root.appendChild(summary);

  // ---- Analytics: streak, weekly chart, subject distribution ----
  const analytics = el('section', { className: 'panel' });
  const streak = computeStreak(data.logs);
  analytics.innerHTML = `<h2>Study Analytics</h2>
    <div class="stat-grid">
      <div class="stat warn"><div class="num">${streak}</div><div class="lbl">Day streak</div></div>
      <div class="stat"><div class="num">${data.logs.reduce((a, l) => a + Number(l.hours), 0).toFixed(1)}h</div><div class="lbl">Total all-time</div></div>
    </div>
    <h3 style="font-size:13px;margin-top:16px;">Last 7 Days</h3>
  `;
  analytics.appendChild(barChart(weeklyHours(data.logs)));
  const subTotals = subjectTotals(data.logs);
  if (subTotals.length) {
    analytics.appendChild(el('h3', { style: 'font-size:13px;margin-top:18px;' }, 'Subject Distribution (all-time)'));
    analytics.appendChild(distributionBars(subTotals));
  }
  root.appendChild(analytics);

  // ---- Log a study session ----
  const logPanel = el('section', { className: 'panel' });
  logPanel.innerHTML = `<h2>Log a Study Session</h2>`;
  const customSubjects = Array.isArray(student.customSubjects) ? student.customSubjects : [];
  const form = el('div', { className: 'form-grid' });
  form.innerHTML = `
    <div>
      <label>Subject</label>
      <select id="ls_subject">
        ${customSubjects.length ? customSubjects.map(s => `<option>${s}</option>`).join('') : ''}
        <option value="__custom__">+ Add my own subject</option>
      </select>
      <input id="ls_subject_custom" placeholder="Type your subject name" style="margin-top:8px;${customSubjects.length ? 'display:none;' : ''}">
    </div>
    <div><label>Topic</label><input id="ls_topic" placeholder="Topic you studied"></div>
    <div><label>Hours</label><input id="ls_hours" type="number" step="0.5" placeholder="e.g. 1.5"></div>
  `;
  logPanel.appendChild(form);

  const subjSelect = form.querySelector('#ls_subject');
  const subjCustom = form.querySelector('#ls_subject_custom');
  if (customSubjects.length === 0) subjSelect.value = '__custom__';
  subjSelect.onchange = () => { subjCustom.style.display = subjSelect.value === '__custom__' ? 'block' : 'none'; };

  const logBtn = el('button', { className: 'btn' }, "Add to Today's Log");
  logBtn.onclick = async () => {
    const hours = Number(form.querySelector('#ls_hours').value);
    if (!hours) return;

    let subject = subjSelect.value;
    if (subject === '__custom__') {
      subject = subjCustom.value.trim();
      if (!subject) { alert('Please type your subject name.'); return; }
      const updatedStudent = await api.addCustomSubject(student.id, subject);
      state.studentSession = updatedStudent; // keep cached session in sync so the new subject shows up right away
    }

    await api.logStudy(student.id, {
      date: TODAY, subject,
      topic: form.querySelector('#ls_topic').value.trim(), hours
    });
    rerender();
  };
  logPanel.appendChild(logBtn);
  root.appendChild(logPanel);

  // ---- Syllabus checklist ----
  // This is built entirely by the student — nothing is pre-filled by default.
  // They add their own subjects and topics below. If their exam target
  // happens to match one of our built-in examples (UPSC, SSC CGL, JEE, NEET),
  // they can optionally copy that in as a starting point with one click.
  const syllPanel = el('section', { className: 'panel' });
  syllPanel.innerHTML = `<h2>Syllabus Progress</h2><p class="sub">Add your own subjects and topics, then check them off as you complete them.</p>`;

  const hasPreset = !!EXAM_SYLLABUS[student.examTarget];
  if (hasPreset) {
    const importBtn = el('button', { className: 'btn ghost', style: 'margin-bottom:16px;font-size:12px;min-height:auto;padding:8px 12px;' },
      `Load example ${student.examTarget} syllabus`);
    importBtn.onclick = async () => {
      const updatedStudent = await api.importSyllabus(student.id, EXAM_SYLLABUS[student.examTarget]);
      state.studentSession = updatedStudent;
      rerender();
    };
    syllPanel.appendChild(importBtn);
  }

  const prog = (data.progress && data.progress[student.examTarget]) || {};
  const mySubjects = Array.isArray(student.customSubjects) ? student.customSubjects : [];
  const myTopics = student.customTopics || {};

  if (mySubjects.length === 0) {
    syllPanel.appendChild(el('p', { className: 'empty' }, 'No subjects yet — add one below to start your own checklist.'));
  }

  mySubjects.forEach(subject => {
    const topics = myTopics[subject] || [];
    const subjProg = prog[subject] || {};
    const doneCount = topics.filter(t => subjProg[t]).length;
    const pct = topics.length ? Math.round((doneCount / topics.length) * 100) : 0;

    const block = el('div', { className: 'subject-block' });
    block.innerHTML = `
      <h4>${subject} <span class="mono" style="color:var(--ink-dim);font-weight:400;font-size:12px;">${doneCount}/${topics.length} · ${pct}%</span></h4>
      <div class="progress-track" style="margin-bottom:8px;"><div class="progress-fill" style="width:${pct}%;"></div></div>
      ${topics.map(t => `
        <label class="topic-row ${subjProg[t] ? 'done' : ''}">
          <input type="checkbox" data-subj="${subject}" data-topic="${t.replace(/"/g, '&quot;')}" ${subjProg[t] ? 'checked' : ''}> ${t}
        </label>
      `).join('')}
      ${topics.length === 0 ? '<p class="empty" style="margin:4px 0 8px;">No topics yet.</p>' : ''}
    `;

    const addTopicRow = el('div', { style: 'display:flex;gap:8px;margin-top:8px;' });
    const topicInput = el('input', { placeholder: 'Add a topic…', style: 'flex:1;' });
    const addTopicBtn = el('button', { className: 'btn ghost', style: 'font-size:12px;min-height:auto;padding:8px 12px;white-space:nowrap;' }, '+ Add Topic');
    addTopicBtn.onclick = async () => {
      const topic = topicInput.value.trim();
      if (!topic) return;
      const updatedStudent = await api.addTopic(student.id, subject, topic);
      state.studentSession = updatedStudent;
      rerender();
    };
    addTopicRow.appendChild(topicInput);
    addTopicRow.appendChild(addTopicBtn);
    block.appendChild(addTopicRow);

    syllPanel.appendChild(block);
  });

  // ---- Add a new subject ----
  const addSubjRow = el('div', { style: 'display:flex;gap:8px;margin-top:6px;' });
  const subjInput = el('input', { placeholder: 'e.g. Reasoning, Static GK…', style: 'flex:1;' });
  const addSubjBtn = el('button', { className: 'btn', style: 'white-space:nowrap;' }, '+ Add Subject');
  addSubjBtn.onclick = async () => {
    const subject = subjInput.value.trim();
    if (!subject) return;
    const updatedStudent = await api.addCustomSubject(student.id, subject);
    state.studentSession = updatedStudent;
    rerender();
  };
  addSubjRow.appendChild(subjInput);
  addSubjRow.appendChild(addSubjBtn);
  syllPanel.appendChild(addSubjRow);

  root.appendChild(syllPanel);
  syllPanel.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.onchange = async () => {
      await api.setProgress(student.id, {
        examTarget: student.examTarget,
        subject: cb.getAttribute('data-subj'),
        topic: cb.getAttribute('data-topic'),
        done: cb.checked
      });
      rerender();
    };
  });

  // ---- Recent log history ----
  const histPanel = el('section', { className: 'panel' });
  histPanel.innerHTML = `<h2>Recent Study Log</h2>`;
  const recent = data.logs.slice(-10).reverse();
  if (recent.length === 0) histPanel.innerHTML += `<p class="empty">No sessions logged yet.</p>`;
  else {
    const wrap = el('div', { className: 'table-scroll' });
    const table = el('table');
    table.innerHTML = `<thead><tr><th>Date</th><th>Subject</th><th>Topic</th><th>Hours</th></tr></thead>
      <tbody>${recent.map(l => `<tr><td class="mono">${l.date}</td><td>${l.subject}</td><td>${l.topic || '—'}</td><td class="mono">${l.hours}h</td></tr>`).join('')}</tbody>`;
    wrap.appendChild(table); histPanel.appendChild(wrap);
  }
  root.appendChild(histPanel);

  // ---- Ask Admin ----
  const askPanel = el('section', { className: 'panel' });
  askPanel.innerHTML = `<h2>Ask Admin</h2><p class="sub">Send a message or question to the library admin.</p>
    <textarea id="askText" rows="3" placeholder="Type your question or request..."></textarea>
    <button class="btn" id="askBtn" style="margin-top:10px;">Send Message</button>`;
  root.appendChild(askPanel);
  askPanel.querySelector('#askBtn').onclick = async () => {
    const text = askPanel.querySelector('#askText').value.trim();
    if (!text) return;
    await api.postQuery(student.id, student.name, text);
    askPanel.querySelector('#askText').value = '';
    alert('Message sent to admin!');
  };

  // ---- Change Password ----
  const pwPanel = el('section', { className: 'panel' });
  pwPanel.innerHTML = `<h2>Change Password</h2><p class="sub">Update the password you use to log in.</p>`;
  const pwForm = el('div', { className: 'form-grid' });
  pwForm.innerHTML = `
    <div><label>Current Password</label><input id="pw_current" type="password" placeholder="Current password"></div>
    <div><label>New Password</label><input id="pw_new" type="password" placeholder="At least 4 characters"></div>
    <div><label>Confirm New Password</label><input id="pw_new2" type="password" placeholder="Re-enter new password"></div>
  `;
  pwPanel.appendChild(pwForm);
  const pwErr = el('div', { style: 'color:var(--closed);font-size:12px;margin-bottom:10px;display:none;' }, '');
  pwPanel.appendChild(pwErr);
  const pwBtn = el('button', { className: 'btn' }, 'Update Password');
  pwBtn.onclick = async () => {
    const current = pwForm.querySelector('#pw_current').value.trim();
    const next = pwForm.querySelector('#pw_new').value.trim();
    const next2 = pwForm.querySelector('#pw_new2').value.trim();
    pwErr.style.display = 'none';
    if (next.length < 4) { pwErr.textContent = 'New password must be at least 4 characters.'; pwErr.style.display = 'block'; return; }
    if (next !== next2) { pwErr.textContent = 'New passwords do not match.'; pwErr.style.display = 'block'; return; }
    try {
      await api.changeStudentPassword(student.id, current, next);
      alert('Password updated!');
      pwForm.querySelector('#pw_current').value = '';
      pwForm.querySelector('#pw_new').value = '';
      pwForm.querySelector('#pw_new2').value = '';
    } catch (e) {
      pwErr.textContent = e.message || 'Could not update password.';
      pwErr.style.display = 'block';
    }
  };
  pwPanel.appendChild(pwBtn);
  root.appendChild(pwPanel);
}

function renderLoginForm(root, rerender) {
  const panel = el('section', { className: 'panel' });
  panel.innerHTML = `<h2>My Account — Log In</h2><p class="sub">Don't have an account yet? Use the "Create Account" tab to sign up, or ask the admin for your Roll Number if they registered you.</p>`;
  const form = el('div', { className: 'form-grid' });
  form.innerHTML = `
    <div><label>Roll Number</label><input id="login_roll" placeholder="e.g. GK-101"></div>
    <div><label>Password</label><input id="login_password" type="password" placeholder="Your password"></div>
  `;
  panel.appendChild(form);
  const errDiv = el('div', { style: 'color:var(--closed);font-size:12px;margin-bottom:10px;display:none;' }, '');
  panel.appendChild(errDiv);
  const loginBtn = el('button', { className: 'btn' }, 'Log In');
  loginBtn.onclick = async () => {
    const roll = form.querySelector('#login_roll').value.trim();
    const password = form.querySelector('#login_password').value.trim();
    try {
      const { student } = await api.studentLogin(roll, password);
      state.studentSession = student;
      rerender();
    } catch (e) {
      if (e.needsSetup) {
        errDiv.style.display = 'none';
        renderSetPasswordForm(root, rerender, roll);
        return;
      }
      errDiv.textContent = e.message || 'No account matches that Roll Number and password.';
      errDiv.style.display = 'block';
    }
  };
  panel.appendChild(loginBtn);

  const setupLink = el('button', { className: 'btn ghost', style: 'margin-top:8px;' }, 'First time logging in? Set your password');
  setupLink.onclick = () => renderSetPasswordForm(root, rerender, form.querySelector('#login_roll').value.trim());
  panel.appendChild(setupLink);

  root.appendChild(panel);
}

function renderSetPasswordForm(root, rerender, prefillRoll) {
  root.innerHTML = '';
  const panel = el('section', { className: 'panel' });
  panel.innerHTML = `<h2>Set Your Password</h2><p class="sub">If the admin registered you, you should already have a Roll Number. Enter it below and choose a password to log in with from now on.</p>`;
  const form = el('div', { className: 'form-grid' });
  form.innerHTML = `
    <div><label>Roll Number</label><input id="setup_roll" placeholder="e.g. CL-101" value="${prefillRoll || ''}"></div>
    <div><label>New Password</label><input id="setup_password" type="password" placeholder="At least 4 characters"></div>
    <div><label>Confirm Password</label><input id="setup_password2" type="password" placeholder="Re-enter password"></div>
  `;
  panel.appendChild(form);
  const errDiv = el('div', { style: 'color:var(--closed);font-size:12px;margin-bottom:10px;display:none;' }, '');
  panel.appendChild(errDiv);

  const saveBtn = el('button', { className: 'btn' }, 'Set Password & Log In');
  saveBtn.onclick = async () => {
    const roll = form.querySelector('#setup_roll').value.trim();
    const password = form.querySelector('#setup_password').value.trim();
    const password2 = form.querySelector('#setup_password2').value.trim();
    if (!roll) { errDiv.textContent = 'Please enter your Roll Number.'; errDiv.style.display = 'block'; return; }
    if (password.length < 4) { errDiv.textContent = 'Password must be at least 4 characters.'; errDiv.style.display = 'block'; return; }
    if (password !== password2) { errDiv.textContent = 'Passwords do not match.'; errDiv.style.display = 'block'; return; }
    try {
      await api.setStudentPassword(roll, password);
      const { student } = await api.studentLogin(roll, password);
      state.studentSession = student;
      rerender();
    } catch (e) {
      errDiv.textContent = e.message || 'Could not set password.';
      errDiv.style.display = 'block';
    }
  };
  panel.appendChild(saveBtn);

  const backBtn = el('button', { className: 'btn ghost', style: 'margin-top:8px;' }, '← Back to Log In');
  backBtn.onclick = () => { root.innerHTML = ''; renderLoginForm(root, rerender); };
  panel.appendChild(backBtn);

  root.appendChild(panel);
}
