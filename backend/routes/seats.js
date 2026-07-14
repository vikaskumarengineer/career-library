const express = require('express');
const router = express.Router();
const { readDb, writeDb } = require('../db');
const asyncHandler = require('../utils/asyncHandler');

function releaseExpiredHolds(db) {
  const now = Date.now();
  let changed = false;
  db.seats.forEach(seat => {
    if (seat.occupantId && seat.holdUntil && now > new Date(seat.holdUntil).getTime()) {
      seat.occupantId = null; seat.shift = null; seat.holdUntil = null;
      changed = true;
    }
  });
  return changed;
}

// GET /api/seats
router.get('/', asyncHandler(async (req, res) => {
  const db = await readDb();
  if (releaseExpiredHolds(db)) await writeDb(db);
  res.json(db.seats);
}));

// POST /api/seats/:seatNo/assign  { studentId, shift }
router.post('/:seatNo/assign', asyncHandler(async (req, res) => {
  const db = await readDb();
  const seat = db.seats.find(s => s.seatNo === Number(req.params.seatNo));
  if (!seat) return res.status(404).json({ message: 'Seat not found' });
  if (seat.occupantId) return res.status(409).json({ message: 'Seat already occupied' });
  seat.occupantId = req.body.studentId;
  seat.shift = req.body.shift || 'Full Day';
  seat.holdUntil = null; // admin-confirmed assignments have no hold timer
  await writeDb(db);
  res.json(seat);
}));

// POST /api/seats/:seatNo/release
router.post('/:seatNo/release', asyncHandler(async (req, res) => {
  const db = await readDb();
  const seat = db.seats.find(s => s.seatNo === Number(req.params.seatNo));
  if (!seat) return res.status(404).json({ message: 'Seat not found' });
  seat.occupantId = null; seat.shift = null; seat.holdUntil = null;
  await writeDb(db);
  res.json(seat);
}));

// POST /api/seats/:seatNo/confirm  — clears the hold timer (called on first check-in)
router.post('/:seatNo/confirm', asyncHandler(async (req, res) => {
  const db = await readDb();
  const seat = db.seats.find(s => s.seatNo === Number(req.params.seatNo));
  if (!seat) return res.status(404).json({ message: 'Seat not found' });
  seat.holdUntil = null;
  await writeDb(db);
  res.json(seat);
}));

module.exports = router;
