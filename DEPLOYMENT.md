# Deploying the MongoDB-backed backend to Render

Follow these steps in order. Steps 1–3 only need to be done once.

## 1. Create a free MongoDB Atlas cluster

1. Go to https://www.mongodb.com/cloud/atlas/register and create a free
   account (or sign in).
2. Create a new **Project**, then click **Build a Database** → choose the
   free **M0** tier → pick any cloud provider/region close to your Render
   region → **Create**.
3. **Database Access** (left sidebar) → **Add New Database User** → create a
   username/password (autogenerate a strong password and save it somewhere
   safe) → give it **Read and write to any database**.
4. **Network Access** (left sidebar) → **Add IP Address** → click **Allow
   Access From Anywhere** (`0.0.0.0/0`). Render's outbound IPs aren't fixed
   on standard plans, so this is the simplest reliable option. (If you're on
   a Render plan with a static outbound IP, you can restrict to just that
   IP instead.)
5. **Database** (left sidebar) → **Connect** on your cluster → **Drivers** →
   copy the connection string. It looks like:
   ```
   mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
   ```
   Replace `<username>` and `<password>` with the database user you created
   in step 3. This full string is your `MONGODB_URI`.

## 2. Migrate your existing data

If your live Render site already has real student/fee/attendance data you
need to keep:

1. Pull the current `db.json` off Render (Render Dashboard → your service →
   **Shell** tab → `cat backend/data/db.json`, copy the output) and save it
   as `backend/data/db.json` locally, replacing the placeholder file.
2. Locally, in the `backend/` folder:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and paste your real `MONGODB_URI` from step 1.
3. Install dependencies and run the migration script:
   ```bash
   npm install
   npm run migrate
   ```
4. You should see output like:
   ```
   ✅ Migration complete.
      Students migrated: 12
      Seats migrated: 40
      Announcements migrated: 3
   ```
5. (Optional but recommended) In Atlas, **Database** → **Browse Collections**
   → confirm you see a `library_management` database with an `appdata`
   collection containing one document with your students, seats, etc.

If you're setting this up fresh with no existing live data, you can skip
this step entirely — the app will auto-create default data in MongoDB the
first time it starts.

## 3. Push the updated code to GitHub

Commit and push everything in this project (the updated `backend/` folder,
`.gitignore`, etc.) to your GitHub repo as usual. `backend/.env` and
`backend/data/db.json` are excluded by `.gitignore` — you don't want your
real password/connection string or a snapshot of student data in git
history.

## 4. Configure Render

1. Render Dashboard → your Web Service → **Environment** tab.
2. Add an environment variable:
   - Key: `MONGODB_URI`
   - Value: your full Atlas connection string from step 1
3. (Optional) Add `MONGODB_DB_NAME` if you want a database name other than
   the default `library_management`.
4. **Build & Start commands** don't need to change:
   - Build command: `npm install` (run inside `backend/`, or `cd backend && npm install` depending on how your service root is configured)
   - Start command: `npm start` (or `node server.js`)
5. If your Render service previously had a **persistent disk** attached
   just to protect `db.json`, you can remove it now — it's no longer
   needed for the JSON data (though see the Uploads note in
   `MIGRATION_NOTES.md` if you still want one for uploaded images).
6. **Manual Deploy** → **Deploy latest commit** (or just push to your
   connected branch, if auto-deploy is on).

## 5. Verify

1. Watch the Render deploy logs. You should see:
   ```
   Connected to MongoDB Atlas (database: "library_management")
   <Your Library Name> server running at http://localhost:...
   ```
   If instead you see a connection error, double-check the `MONGODB_URI`
   value (typos in the password are the most common issue — special
   characters in a password need to be URL-encoded) and that Network Access
   in Atlas allows `0.0.0.0/0`.
2. Open your live site and confirm the admin login, student list, seats,
   etc. all show your migrated data correctly.
3. **The real test:** make a small change in your code (anything, even a
   comment), push it, let Render redeploy, and confirm your data is still
   there afterward. That's the problem this migration fixes.

## Ongoing: every future deploy

Nothing changes about your workflow — keep pushing to GitHub as normal.
Render will redeploy the app code, reconnect to the same MongoDB Atlas
cluster, and all admin-entered data (students, fees, attendance, settings,
announcements, etc.) stays exactly as it was.
