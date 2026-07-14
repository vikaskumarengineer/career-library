const express = require('express');
const router = express.Router();
const { readDb, writeDb } = require('../db');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/timetable
router.get('/', asyncHandler(async (req, res) => {
  const db = await readDb();
  res.json(db.timetable);
}));

// PUT /api/timetable  { day, slot, text }  — set or clear one cell (empty text clears it)
router.put('/', asyncHandler(async (req, res) => {
  const db = await readDb();
  const { day, slot, text } = req.body;
  db.timetable = db.timetable.filter(e => !(e.day === day && e.slot === slot));
  if (text && text.trim()) db.timetable.push({ day, slot, text: text.trim() });
  await writeDb(db);
  res.json(db.timetable);
}));

module.exports = router;
