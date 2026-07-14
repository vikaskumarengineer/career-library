require('dotenv').config(); // loads backend/.env for local dev; on Render, env vars are set in the dashboard and this is a harmless no-op

const express = require('express');
const cors = require('cors');
const path = require('path');
const { readDb, connectDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// serve uploaded library photos
app.use('/uploads', express.static(path.join(__dirname, 'data', 'uploads')));

// API routes — one file per feature area, kept separate on purpose
app.use('/api/auth', require('./routes/auth'));
app.use('/api/students', require('./routes/students'));
app.use('/api/seats', require('./routes/seats'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/timetable', require('./routes/timetable'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/study', require('./routes/study'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/settings', require('./routes/settings'));

// serve the frontend (separate folder, plain HTML/CSS/JS — no build step needed)
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Centralized error handler — catches anything forwarded via next(err) from
// asyncHandler-wrapped routes (e.g. a MongoDB error) so the client always
// gets a clean JSON response instead of the connection just hanging.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ message: 'Internal server error' });
});

// Connect to MongoDB Atlas FIRST, then start accepting requests. If the
// connection string is wrong or Atlas network access isn't configured, the
// deploy fails immediately and loudly here — instead of the app looking
// like it started fine and only breaking on the first API call.
async function start() {
  await connectDB();
  const db = await readDb();
  app.listen(PORT, () => {
    console.log(`${db.settings.libraryName} server running at http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
