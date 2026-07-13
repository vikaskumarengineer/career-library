const express = require('express');
const router = express.Router();
const { readDb, writeDb } = require('../db');

function ensureStudy(db, studentId) {
  if (!db.study[studentId]) db.study[studentId] = { logs: [], progress: {} };
  return db.study[studentId];
}

// GET /api/study — leaderboard helper: totals for every student
router.get('/', (req, res) => {
  const db = readDb();
  const totals = db.students.map(s => {
    const rec = db.study[s.id] || { logs: [] };
    const total = rec.logs.reduce((a, l) => a + Number(l.hours), 0);
    return { studentId: s.id, name: s.name, examTarget: s.examTarget, total };
  });
  res.json(totals);
});

// GET /api/study/:studentId
router.get('/:studentId', (req, res) => {
  const db = readDb();
  res.json(ensureStudy(db, req.params.studentId));
});

// POST /api/study/:studentId/log  { date, subject, topic, hours }
router.post('/:studentId/log', (req, res) => {
  const db = readDb();
  const record = ensureStudy(db, req.params.studentId);
  const { date, subject, topic, hours } = req.body;
  if (!hours || Number(hours) <= 0) return res.status(400).json({ message: 'Hours must be greater than 0' });
  record.logs.push({ date, subject, topic, hours: Number(hours) });
  writeDb(db);
  res.status(201).json(record);
});

// PATCH /api/study/:studentId/progress  { examTarget, subject, topic, done }
router.patch('/:studentId/progress', (req, res) => {
  const db = readDb();
  const record = ensureStudy(db, req.params.studentId);
  const { examTarget, subject, topic, done } = req.body;
  record.progress[examTarget] = record.progress[examTarget] || {};
  record.progress[examTarget][subject] = record.progress[examTarget][subject] || {};
  record.progress[examTarget][subject][topic] = !!done;
  writeDb(db);
  res.json(record);
});

module.exports = router;
