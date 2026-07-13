// state.js — small shared mutable state object.
// Kept in one place so every view module reads/writes the same source of truth.

export const state = {
  currentTab: 'home',
  adminAuthed: false,
  studentSession: null,   // the logged-in student object, or null
  signupSelectedSeat: null
};

export const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'location', label: 'Find Us' },
  { id: 'dashboard', label: 'Dashboard' },
  { label: 'Manage', children: [
      { id: 'students', label: 'Manage Students' },
      { id: 'attendance', label: 'Attendance' },
      { id: 'fees', label: 'Fees' },
      { id: 'timetable', label: 'Timetable' }
  ]},
  { label: 'Office', children: [
      { id: 'reports', label: 'Reports' },
      { id: 'messages', label: 'Messages' },
      { id: 'settings', label: 'Settings' }
  ]},
  { label: 'Student', children: [
      { id: 'signup', label: 'Create Account' },
      { id: 'mystudy', label: 'My Account' },
      { id: 'leaderboard', label: 'Leaderboard' },
      { id: 'gallery', label: 'Gallery' }
  ]}
];

// 'home' is intentionally left out here — it's the public front page
// (library photo, name, address, map, announcements) and is visible to
// anyone visiting the site without logging in. Everything else, including
// the internal Dashboard (seat map, stats), stays behind the admin password.
export const ADMIN_TABS = ['dashboard', 'students', 'attendance', 'fees', 'timetable', 'reports', 'messages', 'settings'];
