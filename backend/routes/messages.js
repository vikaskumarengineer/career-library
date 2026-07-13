const express = require('express');
const router = express.Router();
const { readDb, writeDb } = require('../db');

function uid(prefix) { return prefix + '_' + Math.random().toString(36).slice(2, 9); }

// ---- Announcements ----
// GET /api/messages/announcements
router.get('/announcements', (req, res) => {
  const db = readDb();
  res.json(db.announcements);
});

// POST /api/messages/announcements  { text }
router.post('/announcements', (req, res) => {
  const db = readDb();
  const item = { id: uid('ann'), text: req.body.text, date: new Date().toLocaleDateString('en-IN') };
  db.announcements.push(item);
  writeDb(db);
  res.status(201).json(item);
});

// DELETE /api/messages/announcements/:id
router.delete('/announcements/:id', (req, res) => {
  const db = readDb();
  const before = db.announcements.length;
  db.announcements = db.announcements.filter(a => a.id !== req.params.id);
  if (db.announcements.length === before) return res.status(404).json({ message: 'Announcement not found' });
  writeDb(db);
  res.json({ success: true });
});

// ---- Student queries / "Ask Admin" ----
// GET /api/messages/queries
router.get('/queries', (req, res) => {
  const db = readDb();
  res.json(db.queries);
});

// POST /api/messages/queries  { studentId, studentName, text }
router.post('/queries', (req, res) => {
  const db = readDb();
  const item = {
    id: uid('q'),
    studentId: req.body.studentId,
    studentName: req.body.studentName,
    text: req.body.text,
    date: new Date().toLocaleString('en-IN'),
    resolved: false
  };
  db.queries.push(item);
  writeDb(db);
  res.status(201).json(item);
});

// PATCH /api/messages/queries/:id/resolve
router.patch('/queries/:id/resolve', (req, res) => {
  const db = readDb();
  const q = db.queries.find(x => x.id === req.params.id);
  if (!q) return res.status(404).json({ message: 'Not found' });
  q.resolved = !q.resolved;
  writeDb(db);
  res.json(q);
});

// ---- Personal notifications (admin -> one specific student, e.g. "please pay fee") ----
// GET /api/messages/notifications  — all notifications, for the admin Messages tab
router.get('/notifications', (req, res) => {
  const db = readDb();
  res.json(db.notifications || []);
});

// GET /api/messages/notifications/:studentId  — just one student's notifications, for My Account
router.get('/notifications/:studentId', (req, res) => {
  const db = readDb();
  res.json((db.notifications || []).filter(n => n.studentId === req.params.studentId));
});

// POST /api/messages/notifications  { studentId, studentName, text }
router.post('/notifications', (req, res) => {
  const db = readDb();
  const { studentId, studentName, text } = req.body;
  if (!studentId) return res.status(400).json({ message: 'studentId is required' });
  if (!text || !text.trim()) return res.status(400).json({ message: 'Notification text is required' });
  if (!db.notifications) db.notifications = [];
  const item = {
    id: uid('note'),
    studentId,
    studentName: studentName || '',
    text: text.trim(),
    date: new Date().toLocaleString('en-IN'),
    read: false
  };
  db.notifications.push(item);
  writeDb(db);
  res.status(201).json(item);
});

// PATCH /api/messages/notifications/:id/read — student marks it as seen
router.patch('/notifications/:id/read', (req, res) => {
  const db = readDb();
  const n = (db.notifications || []).find(x => x.id === req.params.id);
  if (!n) return res.status(404).json({ message: 'Not found' });
  n.read = true;
  writeDb(db);
  res.json(n);
});

// DELETE /api/messages/notifications/:id — admin cancels/removes a notification
router.delete('/notifications/:id', (req, res) => {
  const db = readDb();
  db.notifications = (db.notifications || []).filter(n => n.id !== req.params.id);
  writeDb(db);
  res.json({ success: true });
});

// ---- Join enquiries (public "interested in joining" form on the Home page) ----
// GET /api/messages/enquiries
router.get('/enquiries', (req, res) => {
  const db = readDb();
  res.json(db.enquiries || []);
});

// POST /api/messages/enquiries  { name, phone, examTarget, message }
router.post('/enquiries', (req, res) => {
  const db = readDb();
  const { name, phone, examTarget, message } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: 'Name is required' });
  if (!phone || !phone.trim()) return res.status(400).json({ message: 'Phone number is required' });
  if (!db.enquiries) db.enquiries = [];
  const item = {
    id: uid('enq'),
    name: name.trim(),
    phone: phone.trim(),
    examTarget: (examTarget || '').trim(),
    message: (message || '').trim(),
    date: new Date().toLocaleString('en-IN'),
    contacted: false
  };
  db.enquiries.push(item);
  writeDb(db);
  res.status(201).json(item);
});

// PATCH /api/messages/enquiries/:id/contacted
router.patch('/enquiries/:id/contacted', (req, res) => {
  const db = readDb();
  const item = (db.enquiries || []).find(e => e.id === req.params.id);
  if (!item) return res.status(404).json({ message: 'Not found' });
  item.contacted = !item.contacted;
  writeDb(db);
  res.json(item);
});

module.exports = router;
