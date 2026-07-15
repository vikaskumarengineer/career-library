const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const { readDb, writeDb } = require('../db');
const { hashPassword, verifyPassword } = require('../password');
const asyncHandler = require('../utils/asyncHandler');

// ---------------------------------------------------------------------
// WHY THIS FILE NO LONGER WRITES TO LOCAL DISK
//
// Uploaded images (library photos, UPI QR screenshot) used to be saved to
// backend/data/uploads/ with multer's diskStorage, and only a URL like
// "/uploads/library-photo-123.jpg" was stored in MongoDB. That folder lives
// on Render's local container disk, which is wiped on every redeploy — so
// even though the *database* migration fixed students/attendance/fees, the
// photo *files* themselves still vanished (their URLs stayed in MongoDB,
// but the files those URLs pointed to were gone — hence the broken image
// icons after every deploy).
//
// Fix: store the image itself as a base64 data URI directly inside the same
// MongoDB document everything else already lives in. A data URI
// ("data:image/jpeg;base64,...") works as a completely normal value for an
// <img src="..."> — so the frontend needs ZERO changes. Images are resized
// and compressed with sharp first (max 1600px wide, ~72% JPEG quality) to
// keep each one small — typically 100–300KB — so a whole gallery stays
// comfortably under MongoDB's 16MB single-document limit.
// ---------------------------------------------------------------------

const MAX_PHOTOS = 60; // soft safety cap so the document can never approach the 16MB limit

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB raw upload max; sharp compresses it down after
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed'));
    cb(null, true);
  }
});

// Resizes + compresses an uploaded image buffer into a small JPEG, then
// returns it as a data URI ready to store directly in MongoDB and drop
// straight into an <img src="...">.
async function toStoredDataUri(buffer, { maxWidth = 1600, quality = 72 } = {}) {
  const outBuffer = await sharp(buffer)
    .rotate() // respects the photo's EXIF orientation (fixes sideways phone photos)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${outBuffer.toString('base64')}`;
}

// GET /api/settings
router.get('/', asyncHandler(async (req, res) => {
  const db = await readDb();
  // never send the admin password back to the client
  const { adminPassword, ...safeSettings } = db.settings;
  res.json(safeSettings);
}));

// PUT /api/settings  { libraryName, address, lat, lng, adminPhone, upiId, upiPayeeName, feeReminderDay }
router.put('/', asyncHandler(async (req, res) => {
  const db = await readDb();
  const { libraryName, address, lat, lng, adminPhone, upiId, upiPayeeName, feeReminderDay } = req.body;
  if (libraryName !== undefined) db.settings.libraryName = libraryName;
  if (address !== undefined) db.settings.address = address;
  if (lat !== undefined) db.settings.lat = Number(lat);
  if (lng !== undefined) db.settings.lng = Number(lng);
  if (adminPhone !== undefined) db.settings.adminPhone = adminPhone;
  if (upiId !== undefined) db.settings.upiId = upiId;
  if (upiPayeeName !== undefined) db.settings.upiPayeeName = upiPayeeName;
  if (feeReminderDay !== undefined) db.settings.feeReminderDay = Math.min(28, Math.max(1, Number(feeReminderDay) || 5));
  await writeDb(db);
  const { adminPassword, ...safeSettings } = db.settings;
  res.json(safeSettings);
}));

// POST /api/settings/photo  (multipart/form-data, field name "photo")
// Adds a new photo to the banner gallery — does not replace existing ones.
router.post('/photo', upload.single('photo'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No photo uploaded' });
  const db = await readDb();
  if (!Array.isArray(db.settings.photos)) db.settings.photos = [];
  if (db.settings.photos.length >= MAX_PHOTOS) {
    return res.status(400).json({ message: `Gallery is full (max ${MAX_PHOTOS} photos). Delete some old ones first.` });
  }

  const dataUri = await toStoredDataUri(req.file.buffer);
  db.settings.photos.push(dataUri);
  db.settings.photoUrl = dataUri; // kept for any older code paths that still read a single photoUrl
  await writeDb(db);
  res.json({ photoUrl: dataUri, photos: db.settings.photos });
}));

// DELETE /api/settings/photo  { url }
// "url" here is really the stored data URI (or, for anything uploaded
// before this fix, an old "/uploads/..." path) — either way, just remove
// whichever entry matches from the array. Nothing lives on disk to clean
// up anymore.
router.delete('/photo', asyncHandler(async (req, res) => {
  const db = await readDb();
  const { url } = req.body;
  db.settings.photos = (db.settings.photos || []).filter(p => p !== url);
  if (db.settings.photoUrl === url) {
    db.settings.photoUrl = db.settings.photos[db.settings.photos.length - 1] || null;
  }
  await writeDb(db);
  res.json({ photos: db.settings.photos });
}));

// POST /api/settings/qr  (multipart/form-data, field name "qr")
// Admin uploads a screenshot of their REAL UPI QR code (from GPay/PhonePe/Paytm etc).
// We show this image to students as-is — nothing is ever auto-generated, which is
// what was causing "QR not accepted" scan failures.
router.post('/qr', upload.single('qr'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No QR image uploaded' });
  const db = await readDb();
  // QR codes need to stay crisp (scannable), so keep them a bit larger/higher
  // quality than gallery photos, but still compressed enough to store safely.
  const dataUri = await toStoredDataUri(req.file.buffer, { maxWidth: 900, quality: 90 });
  db.settings.upiQrImage = dataUri;
  await writeDb(db);
  res.json({ upiQrImage: dataUri });
}));

// DELETE /api/settings/qr — remove the uploaded QR image
router.delete('/qr', asyncHandler(async (req, res) => {
  const db = await readDb();
  db.settings.upiQrImage = null;
  await writeDb(db);
  res.json({ success: true });
}));

// PUT /api/settings/password  { currentPassword, newPassword }
router.put('/password', asyncHandler(async (req, res) => {
  const db = await readDb();
  const { currentPassword, newPassword } = req.body;
  if (!verifyPassword(currentPassword, db.settings.adminPassword)) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect' });
  }
  if (!newPassword || String(newPassword).trim().length < 4) {
    return res.status(400).json({ success: false, message: 'New password must be at least 4 characters' });
  }
  db.settings.adminPassword = hashPassword(String(newPassword).trim());
  await writeDb(db);
  res.json({ success: true });
}));

module.exports = router;
