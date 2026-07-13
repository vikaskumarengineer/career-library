// state.js — small shared mutable state object.
// Kept in one place so every view module reads/writes the same source of truth.
//
// It's also wrapped in a Proxy that persists a few fields to sessionStorage
// (currentTab, adminAuthed, studentSession). That way, refreshing the page
// (F5) keeps you on the same tab and logged in — the whole app re-fetches
// its data fresh from the server, but you don't get bounced back to Home or
// asked to log in again. Closing the browser tab clears it, same as any
// normal session — so it isn't a permanent "remember me forever" login.

const STORAGE_KEY = 'gyanKakshSession';
const PERSISTED_KEYS = ['currentTab', 'adminAuthed', 'studentSession'];

function loadPersisted() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {}; // sessionStorage unavailable (private browsing, etc.) — just start fresh
  }
}

function persist(key, value) {
  try {
    const existing = loadPersisted();
    existing[key] = value;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch (e) {
    // storage full or unavailable — the app still works, it just won't
    // survive a refresh this time
  }
}

const persisted = loadPersisted();

const rawState = {
  currentTab: persisted.currentTab || 'home',
  adminAuthed: persisted.adminAuthed || false,
  studentSession: persisted.studentSession || null, // the logged-in student object, or null
  signupSelectedSeat: null // deliberately not persisted — sign-up always starts fresh on reload
};

export const state = new Proxy(rawState, {
  set(target, prop, value) {
    target[prop] = value;
    if (PERSISTED_KEYS.includes(prop)) persist(prop, value);
    return true;
  }
});

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
