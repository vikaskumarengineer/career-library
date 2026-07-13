const express = require('express');
const router = express.Router();
const { readDb } = require('../db');

// GET /api/reports/fees
router.get('/fees', (req, res) => {
  const db = readDb();
  const totalPaid = db.students.filter(s => s.feeStatus === 'paid').reduce((a, s) => a + (s.feeAmount || 0), 0);
  const totalDue = db.students.filter(s => s.feeStatus === 'due').reduce((a, s) => a + (s.feeAmount || 0), 0);
  res.json({
    totalPaid,
    totalDue,
    students: db.students.map(s => ({ name: s.name, roll: s.roll, feeAmount: s.feeAmount, feeStatus: s.feeStatus }))
  });
});

// GET /api/reports/occupancy/:date  — check-in times bucketed by hour, for today's activity chart
router.get('/occupancy/:date', (req, res) => {
  const db = readDb();
  const records = db.attendance[req.params.date] || {};
  const buckets = {};
  Object.values(records).forEach(r => {
    if (r.checkIn) {
      const hour = new Date(r.checkIn).getHours();
      buckets[hour] = (buckets[hour] || 0) + 1;
    }
  });
  res.json(buckets);
});

module.exports = router;
