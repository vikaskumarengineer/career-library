# Migration Notes: db.json → MongoDB Atlas

## What changed and why

Your app had one root cause of data loss: `backend/data/db.json` lived on
Render's local disk, which is **ephemeral** — every deploy replaces the
container filesystem, wiping that file back to whatever was last committed to
GitHub. MongoDB Atlas is a separate, always-on database service that Render
deploys never touch. Moving the data there decouples "deploying new code"
from "the data admins entered on the live site" completely.

## Design choice: one document, not many collections

Every route already followed the exact same pattern:

```js
const db = readDb();      // load the whole app state
// ...mutate db.students / db.seats / db.settings / etc...
writeDb(db);               // save the whole app state back
```

Rather than rewrite all 9 route files into per-entity MongoDB collections
(students, seats, attendance, settings...) — which would touch far more code
and introduce far more risk — this migration keeps that same "one big object"
shape, and simply stores that whole object as **one document** in a MongoDB
collection (`appdata`, `_id: "app-data"`). `readDb()`/`writeDb()` still
return/accept the same plain object your routes already know how to use;
they're just `async` now (talking to a network database isn't instant like
reading a local file was).

This is a legitimate, production-safe pattern for this app's scale — a
single library with (realistically) hundreds to low thousands of student
records, nowhere near MongoDB's 16MB single-document limit. If the app ever
grows into a multi-branch or very high-write-concurrency system, splitting
into one collection per entity is the natural next step (each route file
would then query its own collection with proper indexes) — but that's a
bigger, separate project, not something this data-loss fix requires.

## Files changed, and exactly what changed in each

| File | Change |
|---|---|
| `backend/db.js` | Completely rewritten. Instead of `fs.readFileSync`/`writeFileSync` against `data/db.json`, it connects to MongoDB Atlas via the official `mongodb` driver and reads/writes a single document. `readDb()` and `writeDb()` are now `async` (return Promises) but accept/return the exact same object shape as before. Added `connectDB()`, called once at startup. |
| `backend/server.js` | Loads `.env` (for local dev), calls `await connectDB()` before `app.listen(...)` so the app fails fast if Atlas is unreachable, and adds a global Express error-handling middleware. |
| `backend/routes/auth.js` | Handlers changed from `(req, res) => {...}` to `async (req, res) => {...}`, wrapped in `asyncHandler(...)`, and `readDb()`/`writeDb()` calls got `await`. No logic changed. |
| `backend/routes/students.js` | Same async/await treatment as above. No logic changed. |
| `backend/routes/seats.js` | Same async/await treatment. No logic changed. |
| `backend/routes/attendance.js` | Same async/await treatment. No logic changed. |
| `backend/routes/timetable.js` | Same async/await treatment. No logic changed. |
| `backend/routes/messages.js` | Same async/await treatment. No logic changed. |
| `backend/routes/study.js` | Same async/await treatment. No logic changed. |
| `backend/routes/reports.js` | Same async/await treatment. No logic changed. |
| `backend/routes/settings.js` | Same async/await treatment for the JSON data. **File uploads (multer) are unchanged and still write to local disk** — see the Uploads section below. |
| `backend/utils/asyncHandler.js` | **New file.** Small helper so a rejected Promise inside an async route handler (e.g. a dropped MongoDB connection) is forwarded to Express's error handler, instead of crashing the process or hanging the request forever. |
| `backend/scripts/migrate-to-mongo.js` | **New file.** One-time script that reads your existing `backend/data/db.json` and copies it into MongoDB Atlas. Refuses to overwrite existing Atlas data unless you pass `--force`. |
| `backend/package.json` | Added `mongodb` and `dotenv` as dependencies; added an `npm run migrate` script. |
| `backend/.env.example` | **New file.** Documents the `MONGODB_URI` (and optional `MONGODB_DB_NAME`, `PORT`) environment variables. |
| `.gitignore` | **New file.** Keeps `node_modules/`, `backend/.env`, and `backend/data/db.json` (which may contain real student data once you've pulled it down for migration) out of git. |

**Frontend: zero changes.** Every API endpoint (`/api/students`, `/api/seats`,
`/api/auth/admin`, etc.) has the exact same URL, method, request body, and
response shape as before. `frontend/js/api.js` and everything downstream of
it needed no changes at all.

## ⚠️ Uploads (photos, UPI QR) are a separate, still-open issue

Your requirements were specifically about `db.json` data loss, so that's
what this migration fixes. But it's worth flagging clearly: **uploaded
images** (library photos and the UPI QR screenshot, handled by `multer` in
`routes/settings.js`) are saved to `backend/data/uploads/` on local disk —
which is the *same* ephemeral disk `db.json` used to live on. They will
still be wiped on every Render deploy after this migration.

Two ways to fix that too, if you want it (not required for this migration,
since your data — students, fees, attendance, settings — is now safe):

1. **Render persistent disk** (paid add-on) — mount a disk at
   `backend/data/uploads` so files survive deploys. Simplest change, but
   costs extra and doesn't scale to multiple server instances.
2. **Cloud object storage** (e.g. Cloudinary, AWS S3, Cloudflare R2) —
   `multer` swaps its `diskStorage` engine for a cloud-upload engine, and
   `settings.js` stores the returned cloud URL instead of a local `/uploads/…`
   path. More production-grade, but is a separate follow-up task with its
   own new dependency and its own API keys.

## How to fetch db.json from Render (before migrating)

If your live Render instance currently has real data in it that isn't
reflected in your local `backend/data/db.json`, pull the live copy down
first so the migration script has the actual current data, not a stale
local copy:

1. Render Dashboard → your service → **Shell** tab.
2. Run: `cat backend/data/db.json`
3. Copy the JSON output and save it locally as `backend/data/db.json`,
   overwriting your local copy.
4. Then run the migration script as described in `DEPLOYMENT.md`.
