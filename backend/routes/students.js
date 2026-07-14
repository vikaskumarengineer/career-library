const express = require('express');
const router = express.Router();
const { readDb, writeDb, monthKey } = require('../db');
const { hashPassword, verifyPassword } = require('../password');
const asyncHandler = require('../utils/asyncHandler');

function uid(prefix) { return prefix + '_' + Math.random().toString(36).slice(2, 9); }

// Never send the password hash to the browser. Frontend only needs to know
// whether one has been set yet (for the admin's student list), via passwordSet.
function sanitize(student) {
  if (!student) return student;
  const { password, ...rest } = student;
  return { ...rest, passwordSet: !!password };
}

// GET /api/students
router.get('/', asyncHandler(async (req, res) => {
  const db = await readDb();
  res.json(db.students.map(sanitize));
}));

// POST /api/students  — create a student (used by both admin "Add Student" and public "Create Account")
router.post('/', asyncHandler(async (req, res) => {
  const db = await readDb();
  const b = req.body;
  if (!b.name || !b.name.trim()) return res.status(400).json({ message: 'Name is required' });

  // Self-signup always sends a password the student chose. Admin "Add Student"
  // may leave this blank — in that case no password is set yet, and the
  // student sets their own the first time they log in with their Roll Number.
  const password = (b.password && String(b.password).length >= 4) ? hashPassword(b.password) : '';
  const student = {
    id: uid('stu'),
    name: b.name.trim(),
    roll: 'CL-' + (100 + db.students.length),
    gender: b.gender || 'Boy',
    examTarget: b.examTarget || 'Other',
    phone: b.phone || '',
    feeAmount: Number(b.feeAmount) || 0,
    feeStatus: 'due',
    feeHistory: { [monthKey()]: { amount: Number(b.feeAmount) || 0, status: 'due', paidDate: null } },
    password,
    dailyGoalHours: Number(b.dailyGoalHours) || 3,
    customSubjects: [],   // subjects the student adds themselves, beyond the built-in exam syllabus
    customTopics: {},     // { subjectName: [topic, topic, ...] } — the student's own syllabus checklist
    joinDate: new Date().toISOString().slice(0, 10)
  };
  db.students.push(student);

  // optional seat selection at signup — held for 2 hours until first check-in
  if (b.seatNo) {
    const seat = db.seats.find(s => s.seatNo === Number(b.seatNo));
    if (seat && !seat.occupantId) {
      seat.occupantId = student.id;
      seat.shift = b.shift || 'Full Day';
      seat.holdUntil = new Date(Date.now() + 2 * 3600000).toISOString();
    }
  }

  await writeDb(db);
  res.status(201).json(sanitize(student));
}));

// POST /api/students/set-password  { roll, password }
// First-time password setup for accounts the admin created without one.
// Only works while no password exists yet — once set, use /change-password instead.
router.post('/set-password', asyncHandler(async (req, res) => {
  const db = await readDb();
  const { roll, password } = req.body;
  const student = db.students.find(s => s.roll.toLowerCase() === String(roll || '').toLowerCase());
  if (!student) return res.status(404).json({ message: 'No account matches that Roll Number' });
  if (student.password) {
    return res.status(400).json({ message: 'A password is already set for this account. Use "Change Password" instead.' });
  }
  if (!password || String(password).length < 4) {
    return res.status(400).json({ message: 'Password must be at least 4 characters.' });
  }
  student.password = hashPassword(password);
  await writeDb(db);
  res.json({ success: true, student: sanitize(student) });
}));

// PATCH /api/students/:id/password  { currentPassword, newPassword }
router.patch('/:id/password', asyncHandler(async (req, res) => {
  const db = await readDb();
  const student = db.students.find(s => s.id === req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });
  const { currentPassword, newPassword } = req.body;
  if (!verifyPassword(currentPassword, student.password)) {
    return res.status(401).json({ message: 'Current password is incorrect' });
  }
  if (!newPassword || String(newPassword).length < 4) {
    return res.status(400).json({ message: 'New password must be at least 4 characters.' });
  }
  student.password = hashPassword(newPassword);
  await writeDb(db);
  res.json({ success: true, student: sanitize(student) });
}));

// DELETE /api/students/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const db = await readDb();
  db.students = db.students.filter(s => s.id !== req.params.id);
  db.seats.forEach(seat => {
    if (seat.occupantId === req.params.id) { seat.occupantId = null; seat.shift = null; seat.holdUntil = null; }
  });
  await writeDb(db);
  res.json({ success: true });
}));

// PATCH /api/students/:id/fee  { monthKey, status?, amount? }
// Sets a specific month's fee status and/or amount. If that month doesn't
// exist yet on the student, it's created first (so admins can also record
// a past or future month manually, not just the current one).
router.patch('/:id/fee', asyncHandler(async (req, res) => {
  const db = await readDb();
  const student = db.students.find(s => s.id === req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });

  const key = req.body.monthKey || monthKey();
  if (!student.feeHistory) student.feeHistory = {};
  if (!student.feeHistory[key]) {
    const knownMonths = Object.keys(student.feeHistory).sort();
    const lastAmount = knownMonths.length ? student.feeHistory[knownMonths[knownMonths.length - 1]].amount : (student.feeAmount || 0);
    student.feeHistory[key] = { amount: lastAmount, status: 'due', paidDate: null };
  }

  const entry = student.feeHistory[key];
  if (req.body.status) {
    entry.status = req.body.status;
    entry.paidDate = req.body.status === 'paid' ? new Date().toISOString().slice(0, 10) : null;
  }
  if (req.body.amount !== undefined) {
    entry.amount = Number(req.body.amount) || 0;
  }

  // keep the legacy mirrors in sync if we just edited the current month
  if (key === monthKey()) {
    student.feeStatus = entry.status;
    student.feeAmount = entry.amount;
  }

  await writeDb(db);
  res.json(sanitize(student));
}));

// PATCH /api/students/:id/fee/claim  { monthKey }
// A student says "I've paid" after scanning the UPI QR. This does NOT mark
// the fee as paid automatically — there's no payment gateway wired up to
// confirm that money actually arrived. It just flags the month as
// "claimed" (pending review) and drops a note in the admin Messages tab,
// so the admin knows to check their bank/UPI app and confirm manually.
router.patch('/:id/fee/claim', asyncHandler(async (req, res) => {
  const db = await readDb();
  const student = db.students.find(s => s.id === req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });

  const key = req.body.monthKey || monthKey();
  if (!student.feeHistory) student.feeHistory = {};
  if (!student.feeHistory[key]) {
    const knownMonths = Object.keys(student.feeHistory).sort();
    const lastAmount = knownMonths.length ? student.feeHistory[knownMonths[knownMonths.length - 1]].amount : (student.feeAmount || 0);
    student.feeHistory[key] = { amount: lastAmount, status: 'due', paidDate: null };
  }
  const entry = student.feeHistory[key];
  if (entry.status === 'paid') return res.status(400).json({ message: 'This month is already marked paid.' });
  entry.status = 'claimed';
  entry.claimedDate = new Date().toISOString();
  if (key === monthKey()) student.feeStatus = 'claimed';

  db.queries = db.queries || [];
  db.queries.push({
    id: uid('q'),
    studentId: student.id,
    studentName: student.name,
    text: `💰 ${student.name} (${student.roll}) says they paid ₹${entry.amount} for ${key} via UPI. Please verify in your bank/UPI app, then mark it Paid on the Fees tab.`,
    date: new Date().toLocaleString('en-IN'),
    resolved: false
  });

  await writeDb(db);
  res.json(sanitize(student));
}));


router.patch('/:id/subjects', asyncHandler(async (req, res) => {
  const db = await readDb();
  const student = db.students.find(s => s.id === req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });
  const subject = (req.body.subject || '').trim();
  if (!subject) return res.status(400).json({ message: 'Subject name is required' });
  if (!Array.isArray(student.customSubjects)) student.customSubjects = [];
  if (!student.customSubjects.includes(subject)) student.customSubjects.push(subject);
  if (!student.customTopics) student.customTopics = {};
  if (!student.customTopics[subject]) student.customTopics[subject] = [];
  await writeDb(db);
  res.json(sanitize(student));
}));

// PATCH /api/students/:id/topics  { subject, topic }  — student adds a topic under one of their subjects
router.patch('/:id/topics', asyncHandler(async (req, res) => {
  const db = await readDb();
  const student = db.students.find(s => s.id === req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });
  const subject = (req.body.subject || '').trim();
  const topic = (req.body.topic || '').trim();
  if (!subject || !topic) return res.status(400).json({ message: 'Subject and topic are both required' });
  if (!Array.isArray(student.customSubjects)) student.customSubjects = [];
  if (!student.customSubjects.includes(subject)) student.customSubjects.push(subject);
  if (!student.customTopics) student.customTopics = {};
  if (!student.customTopics[subject]) student.customTopics[subject] = [];
  if (!student.customTopics[subject].includes(topic)) student.customTopics[subject].push(topic);
  await writeDb(db);
  res.json(sanitize(student));
}));

// POST /api/students/:id/syllabus/import  { syllabus: { subject: [topic, ...] } }
// Lets a student opt in to copying a built-in example syllabus (e.g. the UPSC one)
// into their own checklist — nothing is ever added here automatically.
router.post('/:id/syllabus/import', asyncHandler(async (req, res) => {
  const db = await readDb();
  const student = db.students.find(s => s.id === req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });
  const syllabus = req.body.syllabus || {};
  if (!Array.isArray(student.customSubjects)) student.customSubjects = [];
  if (!student.customTopics) student.customTopics = {};
  Object.entries(syllabus).forEach(([subject, topics]) => {
    if (!student.customSubjects.includes(subject)) student.customSubjects.push(subject);
    if (!student.customTopics[subject]) student.customTopics[subject] = [];
    (topics || []).forEach(topic => {
      if (!student.customTopics[subject].includes(topic)) student.customTopics[subject].push(topic);
    });
  });
  await writeDb(db);
  res.json(sanitize(student));
}));

module.exports = router;
