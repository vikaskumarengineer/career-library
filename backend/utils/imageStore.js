// imageStore.js — compresses an uploaded image buffer and returns it as a
// base64 data URI, ready to store directly inside a MongoDB document and
// drop straight into an <img src="...">. Shared by routes/settings.js
// (library photos, UPI QR) and routes/students.js (fee payment
// screenshots), so there's one place that decides how images get shrunk
// down before they're stored.
const sharp = require('sharp');

async function toStoredDataUri(buffer, { maxWidth = 1600, quality = 72 } = {}) {
  const outBuffer = await sharp(buffer)
    .rotate() // respects the photo's EXIF orientation (fixes sideways phone photos)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${outBuffer.toString('base64')}`;
}

module.exports = { toStoredDataUri };
