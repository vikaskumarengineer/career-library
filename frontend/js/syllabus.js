// syllabus.js — built-in reference syllabi for well-known exams.
// These are only ever shown to a student if they choose to load them
// (see the "Load example syllabus" button in My Account) — nothing here
// is forced on a student automatically anymore.
export const EXAM_SYLLABUS = {
  UPSC: {
    Polity: ["Preamble & Constitution basics", "Fundamental Rights", "DPSP", "Parliament & Legislature", "Judiciary", "Panchayati Raj"],
    History: ["Ancient India", "Medieval India", "Modern India", "Freedom Struggle"],
    Geography: ["Physical Geography", "Indian Geography", "World Geography", "Climate & Environment"],
    Economy: ["Basic Concepts", "Budget & Fiscal Policy", "Banking & Money", "Five Year Plans / NITI Aayog"],
    "Science & Tech": ["Space Tech", "Biotechnology", "IT & Cyber", "Defence Tech"],
    "Current Affairs": ["National Issues", "International Relations", "Government Schemes"]
  },
  "SSC CGL": {
    Quantitative: ["Number System", "Percentage & Ratio", "Algebra", "Geometry", "Trigonometry", "Data Interpretation"],
    Reasoning: ["Analogy & Classification", "Series", "Coding-Decoding", "Puzzles", "Blood Relations"],
    English: ["Grammar Rules", "Vocabulary", "Reading Comprehension", "One Word Substitution"],
    "General Awareness": ["Static GK", "Science GK", "Current Affairs", "Computer Basics"]
  },
  JEE: {
    Physics: ["Mechanics", "Thermodynamics", "Electrostatics", "Current Electricity", "Optics", "Modern Physics"],
    Chemistry: ["Physical Chemistry", "Organic Chemistry", "Inorganic Chemistry", "Periodic Table"],
    Maths: ["Algebra", "Calculus", "Coordinate Geometry", "Trigonometry", "Vectors & 3D"]
  },
  NEET: {
    Physics: ["Mechanics", "Optics", "Modern Physics", "Electrodynamics"],
    Chemistry: ["Physical Chemistry", "Organic Chemistry", "Inorganic Chemistry"],
    Biology: ["Human Physiology", "Genetics & Evolution", "Plant Physiology", "Ecology", "Cell Biology"]
  },
  Other: { General: ["Subject 1 — Topic A", "Subject 1 — Topic B", "Subject 2 — Topic A"] }
};
