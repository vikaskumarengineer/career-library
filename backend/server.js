const express = require('express');
const cors = require('cors');
const path = require('path');
const { readDb } = require('./db');

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

app.listen(PORT, () => {
  const { libraryName } = readDb().settings;
  console.log(`${libraryName} server running at http://localhost:${PORT}`);
});
