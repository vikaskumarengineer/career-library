const express = require('express');
const router = express.Router();
const { readDb, writeDb } = require('../db');

// GET /api/timetable
router.get('/', (req, res) => {
  const db = readDb();
  res.json(db.timetable);
});

// PUT /api/timetable  { day, slot, text }  — set or clear one cell (empty text clears it)
router.put('/', (req, res) => {
  const db = readDb();
  const { day, slot, text } = req.body;
  db.timetable = db.timetable.filter(e => !(e.day === day && e.slot === slot));
  if (text && text.trim()) db.timetable.push({ day, slot, text: text.trim() });
  writeDb(db);
  res.json(db.timetable);
});

module.exports = router;
