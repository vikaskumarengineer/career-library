// db.js — a tiny JSON-file "database".
// No external database server needed. Everything lives in data/db.json,
// so you can open, read, and back it up like any normal file.

const fs = require('fs');
const path = require('path');
const { hashPassword } = require('./password');

// Computed once at startup — defaultData() is called on every readDb() as a
// fallback-merge template, so hashing here (rather than inside the function)
// avoids re-running bcrypt on every single request.
const DEFAULT_ADMIN_PASSWORD_HASH = hashPassword('admin123');

const DB_FILE = path.join(__dirname, 'data', 'db.json');
const SEAT_COUNT = 40;

// "2026-07" style key for the current month, and a matching display label.
function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Makes sure every student has a fee entry for the current month, creating
// one (as "due") the first time it's needed — this is what makes a new
// month "appear on its own" without anyone having to add it by hand.
// Returns true if it changed anything (so the caller knows to save).
function ensureCurrentMonthFees(db) {
  let changed = false;
  const key = monthKey();
  (db.students || []).forEach(student => {
    if (!student.feeHistory) { student.feeHistory = {}; changed = true; }
    if (!student.feeHistory[key]) {
      const knownMonths = Object.keys(student.feeHistory).sort();
      const lastAmount = knownMonths.length
        ? student.feeHistory[knownMonths[knownMonths.length - 1]].amount
        : (student.feeAmount || 0);
      student.feeHistory[key] = { amount: lastAmount, status: 'due', paidDate: null };
      changed = true;
    }
    // keep these legacy fields mirroring the current month, since older
    // parts of the UI (dashboard stats, reports, the fee banner) still read them
    if (student.feeStatus !== student.feeHistory[key].status || student.feeAmount !== student.feeHistory[key].amount) {
      student.feeStatus = student.feeHistory[key].status;
      student.feeAmount = student.feeHistory[key].amount;
      changed = true;
    }
  });
  return changed;
}

// Automatically nudges students whose current month's fee is still "due"
// once the month reaches settings.feeReminderDay (default: the 5th). Sends
// at most one reminder per student per month — reminderSent on that month's
// feeHistory entry tracks that, so re-running this on every request is safe.
function sendAutoFeeReminders(db) {
  let changed = false;
  const key = monthKey();
  const today = new Date();
  const reminderDay = Number(db.settings && db.settings.feeReminderDay) || 5;
  if (today.getDate() < reminderDay) return false;

  db.notifications = db.notifications || [];
  (db.students || []).forEach(student => {
    const entry = student.feeHistory && student.feeHistory[key];
    if (!entry || entry.status !== 'due' || entry.reminderSent) return;
    db.notifications.push({
      id: 'note_' + Math.random().toString(36).slice(2, 9),
      studentId: student.id,
      studentName: student.name,
      text: `⚠ Reminder: your fee of ₹${entry.amount} for ${key} is still due. Please pay soon to avoid any interruption.`,
      date: new Date().toLocaleString('en-IN'),
      read: false,
      auto: true
    });
    entry.reminderSent = true;
    changed = true;
  });
  return changed;
}

function defaultData() {
  return {
    students: [],           // { id, name, roll, gender, examTarget, phone, feeAmount, feeStatus, password, dailyGoalHours, joinDate }
    seats: Array.from({ length: SEAT_COUNT }, (_, i) => ({
      seatNo: i + 1, occupantId: null, shift: null, holdUntil: null
    })),
    timetable: [],           // { day, slot, text }
    announcements: [],        // { id, text, date }
    queries: [],              // { id, studentId, studentName, text, date, resolved }
    notifications: [],        // { id, studentId, studentName, text, date, read } — admin -> specific student notices (e.g. "please pay fee")
    enquiries: [],            // { id, name, phone, examTarget, message, date, contacted } — public "join" form leads
    attendance: {},           // { "YYYY-MM-DD": { studentId: { checkIn, checkOut } } }
    study: {},                // { studentId: { logs: [...], progress: {...} } }
    settings: {
      libraryName: 'Carrier Digital Library',
      address: 'Chaubeypur, Gonda, Uttar Pradesh',
      lat: 26.8467,           // default: Lucknow, editable from admin Settings tab
      lng: 80.9462,
      photoUrl: null,
      photos: [],           // list of uploaded library photo URLs, used for the home page banner carousel
      upiId: '',             // e.g. "yourlibrary@okhdfcbank" — shown as text next to the QR
      upiPayeeName: '',      // name shown next to the QR / in receipts
      upiQrImage: null,      // URL of the admin-uploaded real UPI QR screenshot (shown to students as-is, never auto-generated)
      adminPhone: '',        // library admin's contact number, shown to students/visitors
      adminPassword: DEFAULT_ADMIN_PASSWORD_HASH,
      feeReminderDay: 5    // day of the month an automatic "fee due" reminder is sent, if still unpaid
    }
  };
}

function ensureDbFile() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData(), null, 2));
  }
}

function readDb() {
  ensureDbFile();
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  try {
    const data = JSON.parse(raw);
    // fill in any missing top-level keys (in case of upgrades)
    const merged = Object.assign(defaultData(), data);
    // settings is merged shallowly above, so an older db.json (saved before
    // the "photos" field existed) would be missing it — fill it back in.
    merged.settings = Object.assign(defaultData().settings, data.settings || {});
    if (!Array.isArray(merged.settings.photos)) merged.settings.photos = [];
    if (!merged.seats || merged.seats.length !== SEAT_COUNT) merged.seats = defaultData().seats;
    if (ensureCurrentMonthFees(merged)) writeDb(merged);
    if (sendAutoFeeReminders(merged)) writeDb(merged);
    return merged;
  } catch (e) {
    console.error('db.json was corrupted, resetting to defaults', e);
    const fresh = defaultData();
    writeDb(fresh);
    return fresh;
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

module.exports = { readDb, writeDb, SEAT_COUNT, monthKey };
