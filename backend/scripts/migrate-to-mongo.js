// scripts/migrate-to-mongo.js
//
// One-time script that copies your EXISTING backend/data/db.json (with all
// your real students, fees, attendance, settings, etc.) into MongoDB Atlas,
// so you don't lose anything you've already entered on the live site.
//
// USAGE
//   1. Make sure backend/.env has MONGODB_URI set (see .env.example), OR
//      export MONGODB_URI in your shell before running this.
//   2. Get the CURRENT db.json off your live Render instance first if you
//      haven't already — see "How to fetch db.json from Render" in
//      MIGRATION_NOTES.md. Put that file at backend/data/db.json.
//   3. From the backend/ folder, run:
//        node scripts/migrate-to-mongo.js
//
// SAFETY
//   - By default this REFUSES to overwrite a document that already exists
//     in MongoDB (so you can't accidentally run it twice and clobber live
//     data with a stale local file).
//   - Pass --force to overwrite anyway:
//        node scripts/migrate-to-mongo.js --force

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const DB_FILE = path.join(__dirname, '..', 'data', 'db.json');
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'library_management';
const COLLECTION_NAME = 'appdata';
const DOC_ID = 'app-data';
const FORCE = process.argv.includes('--force');

async function main() {
  if (!MONGODB_URI) {
    console.error('ERROR: MONGODB_URI is not set. Add it to backend/.env or export it in your shell.');
    process.exit(1);
  }

  if (!fs.existsSync(DB_FILE)) {
    console.error(`ERROR: ${DB_FILE} not found. Nothing to migrate.`);
    process.exit(1);
  }

  console.log(`Reading ${DB_FILE} ...`);
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error('ERROR: db.json is not valid JSON:', e.message);
    process.exit(1);
  }

  console.log(`Connecting to MongoDB Atlas (database: "${DB_NAME}") ...`);
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const collection = client.db(DB_NAME).collection(COLLECTION_NAME);

  const existing = await collection.findOne({ _id: DOC_ID });
  if (existing && !FORCE) {
    console.error(
      'A document already exists in MongoDB for this app.\n' +
      'Refusing to overwrite it to avoid accidentally erasing live data.\n' +
      'If you are SURE you want to replace it with the contents of db.json, re-run with --force:\n' +
      '  node scripts/migrate-to-mongo.js --force'
    );
    await client.close();
    process.exit(1);
  }

  const doc = { ...data, _id: DOC_ID };
  await collection.updateOne({ _id: DOC_ID }, { $set: doc }, { upsert: true });

  console.log('✅ Migration complete.');
  console.log(`   Students migrated: ${(data.students || []).length}`);
  console.log(`   Seats migrated: ${(data.seats || []).length}`);
  console.log(`   Announcements migrated: ${(data.announcements || []).length}`);
  console.log('You can now deploy the updated backend — it will read/write this MongoDB document from now on.');

  await client.close();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
