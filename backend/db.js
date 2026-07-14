// db.js — MongoDB Atlas–backed replacement for the old JSON-file "database".
//
// WHY IT'S SHAPED THIS WAY
// The rest of the app (every route file) already does:
//     const db = readDb();
//     ... mutate db.students / db.seats / db.settings / etc ...
//     writeDb(db);
// That pattern is preserved exactly — readDb()/writeDb() still hand back and
// accept the *same* plain JS object shape the old db.json had. The only
// change routes need is adding `await` in front of the calls, because talking
// to MongoDB is asynchronous (unlike fs.readFileSync/writeFileSync).
//
// HOW DATA IS STORED
// The entire app state (students, seats, attendance, settings, ...) is kept
// as ONE document in a MongoDB collection, at a fixed _id ("app-data"). This
// mirrors the old db.json structure almost exactly, which is what makes this
// a low-risk, drop-in migration instead of a ground-up rewrite. It's a good
// fit for this app's current scale (one library, at most a few thousand
// students/attendance rows — nowhere near MongoDB's 16MB single-document
// limit). If this ever grows into a multi-branch / high-concurrency system,
// splitting into one collection per entity (students, seats, attendance...)
// is the natural next step — see MIGRATION_NOTES.md for that path.
//
// WHY THIS FIXES THE DATA-LOSS PROBLEM
// db.json lived on Render's local (ephemeral) disk, which is wiped and
// replaced on every deploy. MongoDB Atlas is a separate, always-on database
// service — deploying new code to Render never touches it. Code changes and
// data are now fully decoupled.

const { MongoClient } = require('mongodb');
const { hashPassword } = require('./password');

const DEFAULT_ADMIN_PASSWORD_HASH = hashPassword('admin123');
const SEAT_COUNT = 40;

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'library_management';
const COLLECTION_NAME = 'appdata';
const DOC_ID = 'app-data';

if (!MONGODB_URI) {
  console.error(
    'FATAL: MONGODB_URI environment variable is not set.\n' +
    'Create backend/.env locally (see .env.example) or, on Render, add it under\n' +
    'Dashboard → your service → Environment.'
  );
  process.exit(1);
}

let client;
let collection;
let connectingPromise; // guards against opening multiple connections if several requests race in before the first connect() finishes

async function getCollection() {
  if (collection) return collection;
  if (!connectingPromise) {
    connectingPromise = (async () => {
      client = new MongoClient(MONGODB_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10000
      });
      await client.connect();
      const database = client.db(DB_NAME);
      collection = database.collection(COLLECTION_NAME);
      console.log(`Connected to MongoDB Atlas (database: "${DB_NAME}")`);
      return collection;
    })();
  }
  return connectingPromise;
}

// Called once from server.js at startup, so a bad connection string / IP
// whitelist issue fails the deploy immediately and loudly — instead of the
// app appearing to start fine and only breaking on the first API request.
async function connectDB() {
  await getCollection();
}

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
    _id: DOC_ID,
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

function stripId(data) {
  const { _id, ...rest } = data;
  return rest;
}

// Reads the single app-data document, creating it with defaults on first
// run (equivalent to the old ensureDbFile()), then applies the same
// "fill in missing keys" / auto-monthly-fee / auto-reminder logic the old
// db.js ran on every read. Returns a plain object — same shape as before.
async function readDb() {
  const col = await getCollection();
  let data = await col.findOne({ _id: DOC_ID });

  if (!data) {
    data = defaultData();
    await col.insertOne(data);
    return stripId(data);
  }

  // fill in any missing top-level keys (in case of upgrades)
  const merged = Object.assign(defaultData(), data);
  // settings is merged shallowly above, so an older document (saved before
  // the "photos" field existed) would be missing it — fill it back in.
  merged.settings = Object.assign(defaultData().settings, data.settings || {});
  if (!Array.isArray(merged.settings.photos)) merged.settings.photos = [];
  if (!merged.seats || merged.seats.length !== SEAT_COUNT) merged.seats = defaultData().seats;

  let changed = false;
  if (ensureCurrentMonthFees(merged)) changed = true;
  if (sendAutoFeeReminders(merged)) changed = true;
  if (changed) await writeDb(stripId(merged));

  return stripId(merged);
}

async function writeDb(data) {
  const col = await getCollection();
  const { _id, ...rest } = data;
  await col.updateOne({ _id: DOC_ID }, { $set: rest }, { upsert: true });
}

module.exports = { readDb, writeDb, connectDB, SEAT_COUNT, monthKey };
