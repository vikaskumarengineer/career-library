// api.js — every call to the backend goes through here.
// Keeping this in one file means if the backend URL or shape ever changes,
// this is the only file that needs updating.


const BASE = 'https://carrier-digital-library.onrender.com';// same-origin; change to 'http://localhost:4000' if hosting frontend separately

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.message || ('Request failed: ' + res.status));
    if (body.needsSetup) err.needsSetup = true;
    throw err;
  }
  return res.json();
}

export const api = {
  // auth
  adminLogin: (password) => request('/api/auth/admin', { method: 'POST', body: JSON.stringify({ password }) }),
  studentLogin: (roll, password) => request('/api/auth/student', { method: 'POST', body: JSON.stringify({ roll, password }) }),
  setStudentPassword: (roll, password) => request('/api/students/set-password', { method: 'POST', body: JSON.stringify({ roll, password }) }),
  changeStudentPassword: (studentId, currentPassword, newPassword) =>
    request(`/api/students/${studentId}/password`, { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) }),

  // students
  getStudents: () => request('/api/students'),
  createStudent: (data) => request('/api/students', { method: 'POST', body: JSON.stringify(data) }),
  addCustomSubject: (studentId, subject) => request(`/api/students/${studentId}/subjects`, { method: 'PATCH', body: JSON.stringify({ subject }) }),
  addTopic: (studentId, subject, topic) => request(`/api/students/${studentId}/topics`, { method: 'PATCH', body: JSON.stringify({ subject, topic }) }),
  importSyllabus: (studentId, syllabus) => request(`/api/students/${studentId}/syllabus/import`, { method: 'POST', body: JSON.stringify({ syllabus }) }),
  deleteStudent: (id) => request('/api/students/' + id, { method: 'DELETE' }),
  setFeeMonth: (id, monthKey, status) => request('/api/students/' + id + '/fee', { method: 'PATCH', body: JSON.stringify({ monthKey, status }) }),
  claimPayment: async (id, monthKey, screenshotFile) => {
    const form = new FormData();
    form.append('monthKey', monthKey);
    if (screenshotFile) form.append('screenshot', screenshotFile);
    const res = await fetch(BASE + `/api/students/${id}/fee/claim`, { method: 'PATCH', body: form });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || 'Could not submit payment claim');
    }
    return res.json();
  },

  // seats
  getSeats: () => request('/api/seats'),
  assignSeat: (seatNo, studentId, shift) =>
    request(`/api/seats/${seatNo}/assign`, { method: 'POST', body: JSON.stringify({ studentId, shift }) }),
  releaseSeat: (seatNo) => request(`/api/seats/${seatNo}/release`, { method: 'POST' }),

  // attendance
  getAttendance: (date) => request('/api/attendance/' + date),
  checkIn: (date, studentId) => request(`/api/attendance/${date}/checkin`, { method: 'POST', body: JSON.stringify({ studentId }) }),
  checkOut: (date, studentId) => request(`/api/attendance/${date}/checkout`, { method: 'POST', body: JSON.stringify({ studentId }) }),
  attendanceReport: (monthPrefix) => request('/api/attendance/report/' + monthPrefix),

  // timetable
  getTimetable: () => request('/api/timetable'),
  setTimetableSlot: (day, slot, text) => request('/api/timetable', { method: 'PUT', body: JSON.stringify({ day, slot, text }) }),

  // messages / announcements
  getAnnouncements: () => request('/api/messages/announcements'),
  postAnnouncement: (text) => request('/api/messages/announcements', { method: 'POST', body: JSON.stringify({ text }) }),
  deleteAnnouncement: (id) => request('/api/messages/announcements/' + id, { method: 'DELETE' }),
  getQueries: () => request('/api/messages/queries'),
  postQuery: (studentId, studentName, text) =>
    request('/api/messages/queries', { method: 'POST', body: JSON.stringify({ studentId, studentName, text }) }),
  resolveQuery: (id) => request(`/api/messages/queries/${id}/resolve`, { method: 'PATCH' }),
  getEnquiries: () => request('/api/messages/enquiries'),
  submitEnquiry: (data) => request('/api/messages/enquiries', { method: 'POST', body: JSON.stringify(data) }),
  toggleEnquiryContacted: (id) => request(`/api/messages/enquiries/${id}/contacted`, { method: 'PATCH' }),
  getNotifications: () => request('/api/messages/notifications'),
  getStudentNotifications: (studentId) => request('/api/messages/notifications/' + studentId),
  sendNotification: (studentId, studentName, text) =>
    request('/api/messages/notifications', { method: 'POST', body: JSON.stringify({ studentId, studentName, text }) }),
  markNotificationRead: (id) => request(`/api/messages/notifications/${id}/read`, { method: 'PATCH' }),
  deleteNotification: (id) => request(`/api/messages/notifications/${id}`, { method: 'DELETE' }),

  // study tracker
  getStudy: (studentId) => request('/api/study/' + studentId),
  logStudy: (studentId, entry) => request(`/api/study/${studentId}/log`, { method: 'POST', body: JSON.stringify(entry) }),
  setProgress: (studentId, payload) => request(`/api/study/${studentId}/progress`, { method: 'PATCH', body: JSON.stringify(payload) }),
  getLeaderboard: () => request('/api/study'),

  // reports
  getFeeReport: () => request('/api/reports/fees'),
  getOccupancy: (date) => request('/api/reports/occupancy/' + date),

  // settings
  getSettings: () => request('/api/settings'),
  updateSettings: (data) => request('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),
  changeAdminPassword: (currentPassword, newPassword) =>
    request('/api/settings/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) }),
  uploadPhoto: async (file) => {
    const form = new FormData();
    form.append('photo', file);
    const res = await fetch(BASE + '/api/settings/photo', { method: 'POST', body: form });
    if (!res.ok) throw new Error('Photo upload failed');
    return res.json();
  },
  deletePhoto: (url) => request('/api/settings/photo', { method: 'DELETE', body: JSON.stringify({ url }) }),
  uploadQr: async (file) => {
    const form = new FormData();
    form.append('qr', file);
    const res = await fetch(BASE + '/api/settings/qr', { method: 'POST', body: form });
    if (!res.ok) throw new Error('QR upload failed');
    return res.json();
  },
  deleteQr: () => request('/api/settings/qr', { method: 'DELETE' })
};
