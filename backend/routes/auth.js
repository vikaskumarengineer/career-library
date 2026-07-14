const express = require('express');
const router = express.Router();
const { readDb } = require('../db');
const { verifyPassword } = require('../password');
const asyncHandler = require('../utils/asyncHandler');

// POST /api/auth/admin  { password }
router.post('/admin', asyncHandler(async (req, res) => {
  const db = await readDb();
  const { password } = req.body;
  if (verifyPassword(password, db.settings.adminPassword)) {
    return res.json({ success: true });
  }
  res.status(401).json({ success: false, message: 'Incorrect password' });
}));

// POST /api/auth/student  { roll, password }
router.post('/student', asyncHandler(async (req, res) => {
  const db = await readDb();
  const { roll, password } = req.body;
  const student = db.students.find(
    s => s.roll.toLowerCase() === String(roll || '').toLowerCase()
  );

  if (!student) {
    return res.status(401).json({ success: false, message: 'No account matches that Roll Number' });
  }

  if (!student.password) {
    // Admin created this account and hasn't set a password yet — the
    // student needs to set their own before they can log in.
    return res.status(409).json({ success: false, needsSetup: true, message: 'No password has been set for this account yet. Please set one first.' });
  }

  if (!verifyPassword(password, student.password)) {
    return res.status(401).json({ success: false, message: 'Incorrect password for that Roll Number' });
  }

  const { password: _omit, ...safeStudent } = student;
  res.json({ success: true, student: safeStudent });
}));

module.exports = router;
