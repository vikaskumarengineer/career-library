const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { readDb, writeDb } = require('../db');
const { hashPassword, verifyPassword } = require('../password');

const UPLOAD_DIR = path.join(__dirname, '..', 'data', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'library-photo-' + Date.now() + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed'));
    cb(null, true);
  }
});

const qrStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'upi-qr-' + Date.now() + ext);
  }
});
const uploadQr = multer({
  storage: qrStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed'));
    cb(null, true);
  }
});

// GET /api/settings
router.get('/', (req, res) => {
  const db = readDb();
  // never send the admin password back to the client
  const { adminPassword, ...safeSettings } = db.settings;
  res.json(safeSettings);
});

// PUT /api/settings  { libraryName, address, lat, lng, adminPhone, upiId, upiPayeeName, feeReminderDay }
router.put('/', (req, res) => {
  const db = readDb();
  const { libraryName, address, lat, lng, adminPhone, upiId, upiPayeeName, feeReminderDay } = req.body;
  if (libraryName !== undefined) db.settings.libraryName = libraryName;
  if (address !== undefined) db.settings.address = address;
  if (lat !== undefined) db.settings.lat = Number(lat);
  if (lng !== undefined) db.settings.lng = Number(lng);
  if (adminPhone !== undefined) db.settings.adminPhone = adminPhone;
  if (upiId !== undefined) db.settings.upiId = upiId;
  if (upiPayeeName !== undefined) db.settings.upiPayeeName = upiPayeeName;
  if (feeReminderDay !== undefined) db.settings.feeReminderDay = Math.min(28, Math.max(1, Number(feeReminderDay) || 5));
  writeDb(db);
  const { adminPassword, ...safeSettings } = db.settings;
  res.json(safeSettings);
});

// POST /api/settings/photo  (multipart/form-data, field name "photo")
// Adds a new photo to the banner gallery — does not replace existing ones.
router.post('/photo', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No photo uploaded' });
  const db = readDb();
  const url = '/uploads/' + req.file.filename;
  if (!Array.isArray(db.settings.photos)) db.settings.photos = [];
  db.settings.photos.push(url);
  db.settings.photoUrl = url; // kept for any older code paths that still read a single photoUrl
  writeDb(db);
  res.json({ photoUrl: url, photos: db.settings.photos });
});

// DELETE /api/settings/photo  { url }
router.delete('/photo', (req, res) => {
  const db = readDb();
  const { url } = req.body;
  db.settings.photos = (db.settings.photos || []).filter(p => p !== url);
  if (db.settings.photoUrl === url) {
    db.settings.photoUrl = db.settings.photos[db.settings.photos.length - 1] || null;
  }
  writeDb(db);
  // best-effort: remove the actual file from disk too
  const filename = url && url.split('/').pop();
  if (filename) {
    const filePath = path.join(UPLOAD_DIR, filename);
    fs.unlink(filePath, () => {});
  }
  res.json({ photos: db.settings.photos });
});

// POST /api/settings/qr  (multipart/form-data, field name "qr")
// Admin uploads a screenshot of their REAL UPI QR code (from GPay/PhonePe/Paytm etc).
// We show this image to students as-is — nothing is ever auto-generated, which is
// what was causing "QR not accepted" scan failures.
router.post('/qr', uploadQr.single('qr'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No QR image uploaded' });
  const db = readDb();
  const oldUrl = db.settings.upiQrImage;
  const url = '/uploads/' + req.file.filename;
  db.settings.upiQrImage = url;
  writeDb(db);
  // best-effort: remove the previous QR image file from disk
  if (oldUrl) {
    const oldFilename = oldUrl.split('/').pop();
    if (oldFilename) fs.unlink(path.join(UPLOAD_DIR, oldFilename), () => {});
  }
  res.json({ upiQrImage: url });
});

// DELETE /api/settings/qr — remove the uploaded QR image
router.delete('/qr', (req, res) => {
  const db = readDb();
  const url = db.settings.upiQrImage;
  db.settings.upiQrImage = null;
  writeDb(db);
  if (url) {
    const filename = url.split('/').pop();
    if (filename) fs.unlink(path.join(UPLOAD_DIR, filename), () => {});
  }
  res.json({ success: true });
});

// PUT /api/settings/password  { currentPassword, newPassword }
router.put('/password', (req, res) => {
  const db = readDb();
  const { currentPassword, newPassword } = req.body;
  if (!verifyPassword(currentPassword, db.settings.adminPassword)) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect' });
  }
  if (!newPassword || String(newPassword).trim().length < 4) {
    return res.status(400).json({ success: false, message: 'New password must be at least 4 characters' });
  }
  db.settings.adminPassword = hashPassword(String(newPassword).trim());
  writeDb(db);
  res.json({ success: true });
});

module.exports = router;
