# Gyan Kaksh Library — Full-Stack Management System

A complete library/coaching-center management system: seat booking, attendance,
fees, syllabus tracking, study analytics, announcements, a dashboard photo,
and a real map of the library's location.

## Structure

```
library-fullstack/
├── backend/            Node.js + Express API (own file per feature)
│   ├── server.js        entry point
│   ├── db.js             tiny JSON-file database (no separate DB server needed)
│   ├── data/
│   │   ├── db.json        all your data lives here (auto-created on first run)
│   │   └── uploads/       uploaded library photos
│   └── routes/
│       ├── auth.js         admin + student login
│       ├── students.js     add/remove students, toggle fee
│       ├── seats.js        seat map assign/release
│       ├── attendance.js   check-in/check-out, monthly report
│       ├── timetable.js    weekly timetable
│       ├── messages.js     announcements + student queries
│       ├── study.js        study log + syllabus progress + leaderboard
│       ├── reports.js      fee summary, occupancy chart
│       └── settings.js     library name/address/map + photo upload
│
└── frontend/            Plain HTML/CSS/JS (no build step, no framework)
    ├── index.html
    ├── css/style.css
    └── js/
        ├── api.js              all backend calls in one place
        ├── syllabus.js         static exam syllabus data
        ├── ui.js                shared helpers (charts, CSV export, etc.)
        ├── state.js             shared app state
        ├── seatTicket.js        seat assign/release modal
        ├── announcementBanner.js
        ├── viewAdminLogin.js
        ├── viewDashboard.js     stats, photo, map, seat map, announcements
        ├── viewStudents.js
        ├── viewAttendance.js
        ├── viewFees.js
        ├── viewTimetable.js
        ├── viewReports.js
        ├── viewMessages.js
        ├── viewSettings.js      photo upload + map location picker
        ├── viewSignup.js
        ├── viewMyAccount.js
        ├── viewLeaderboard.js
        └── main.js              tab router that wires it all together
```

## Running it

You need [Node.js](https://nodejs.org) installed (v18 or newer).

```bash
cd backend
npm install
npm start
```

Then open **http://localhost:4000** in your browser. The backend also serves
the frontend, so you only need to run one command.

## Login details

- **Admin password**: `admin123` (change it in `backend/data/db.json` under
  `settings.adminPassword` after the server has run once — or edit the
  default in `backend/db.js` before first run — then restart the server)
- **Students**: log in with the Roll Number + PIN they get when they sign up
  from the "Create Account" tab.

## Dashboard photo & map

- Go to the **Settings** tab (admin) to upload a library photo — it appears
  on the Dashboard for everyone.
- On the same tab, click anywhere on the map (or search an address) to set
  your library's exact location. It uses free OpenStreetMap tiles and the
  Nominatim address search — no API key required.

## Data storage

Everything is stored in `backend/data/db.json` — a single readable JSON
file. Back it up by copying that file. Uploaded photos live in
`backend/data/uploads/`.

## Notes on scale & security

This is built for a single small library/coaching center, not a
multi-tenant SaaS product:

- PINs and the admin password are stored in plain text in `db.json`. Fine
  for one room's internal use; not meant for storing sensitive data at
  scale.
- The JSON-file database is simple and easy to inspect/back up, but isn't
  built for very high traffic. If you outgrow it, swap `db.js` for a real
  database (Postgres, MongoDB, etc.) — the route files already talk to
  `db.js` through a small, consistent interface, so that's the only file
  you'd need to replace.
- For production use (real student data, public internet exposure), add
  HTTPS, hashed passwords, and rate limiting.
