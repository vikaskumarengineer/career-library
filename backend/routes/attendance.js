const express = require('express');
const router = express.Router();
const { readDb, writeDb } = require('../db');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/attendance/:date  (date = YYYY-MM-DD)
router.get('/:date', asyncHandler(async (req, res) => {
  const db = await readDb();
  res.json(db.attendance[req.params.date] || {});
}));

// POST /api/attendance/:date/checkin  { studentId }
router.post('/:date/checkin', asyncHandler(async (req, res) => {
  const db = await readDb();
  const { date } = req.params;
  const { studentId } = req.body;
  db.attendance[date] = db.attendance[date] || {};
  db.attendance[date][studentId] = { checkIn: new Date().toISOString() };

  // clear seat hold on first check-in
  const seat = db.seats.find(s => s.occupantId === studentId);
  if (seat && seat.holdUntil) seat.holdUntil = null;

  await writeDb(db);
  res.json(db.attendance[date][studentId]);
}));

// POST /api/attendance/:date/checkout  { studentId }
router.post('/:date/checkout', asyncHandler(async (req, res) => {
  const db = await readDb();
  const { date } = req.params;
  const { studentId } = req.body;
  if (!db.attendance[date] || !db.attendance[date][studentId]) {
    return res.status(400).json({ message: 'No check-in found for today' });
  }
  db.attendance[date][studentId].checkOut = new Date().toISOString();
  await writeDb(db);
  res.json(db.attendance[date][studentId]);
}));

// GET /api/attendance-keys/:monthPrefix  (e.g. 2026-07) — used by monthly reports
router.get('/report/:monthPrefix', asyncHandler(async (req, res) => {
  const db = await readDb();
  const { monthPrefix } = req.params;
  const totals = {};
  Object.entries(db.attendance).forEach(([date, records]) => {
    if (!date.startsWith(monthPrefix)) return;
    Object.entries(records).forEach(([studentId, rec]) => {
      if (rec.checkIn && rec.checkOut) {
        const hours = (new Date(rec.checkOut) - new Date(rec.checkIn)) / 3600000;
        totals[studentId] = (totals[studentId] || 0) + hours;
      }
    });
  });
  res.json(totals);
}));

module.exports = router;
