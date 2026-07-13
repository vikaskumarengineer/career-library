// ui.js — small shared helpers so every view file doesn't repeat this logic.

export const TODAY = new Date().toISOString().slice(0, 10);
export const MONTH_PREFIX = TODAY.slice(0, 7);
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const SLOTS = ["7-9am", "9-11am", "11-1pm", "1-3pm", "3-5pm", "5-7pm", "7-9pm"];

export function el(tag, props = {}, html = '') {
  const node = document.createElement(tag);
  Object.assign(node, props);
  if (html) node.innerHTML = html;
  return node;
}

export function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function toCSV(rows) {
  return rows.map(r => r.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\n');
}

export function downloadCSV(filename, rows) {
  const blob = new Blob([toCSV(rows)], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}

export function computeStreak(logs) {
  const daysWithStudy = new Set(logs.filter(l => Number(l.hours) > 0).map(l => l.date));
  let streak = 0;
  let cursor = new Date(TODAY);
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (daysWithStudy.has(key)) { streak++; cursor.setDate(cursor.getDate() - 1); }
    else break;
  }
  return streak;
}

export function weeklyHours(logs) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const total = logs.filter(l => l.date === key).reduce((a, l) => a + Number(l.hours), 0);
    days.push({ label: d.toLocaleDateString('en-IN', { weekday: 'short' }), total });
  }
  return days;
}

export function subjectTotals(logs) {
  const map = {};
  logs.forEach(l => { map[l.subject] = (map[l.subject] || 0) + Number(l.hours); });
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

export function barChart(dataPoints) {
  // dataPoints: [{label, total}]
  const max = Math.max(...dataPoints.map(d => d.total), 1);
  const wrap = el('div', { className: 'chart-row' });
  dataPoints.forEach(d => {
    const col = el('div', { className: 'chart-bar-wrap' });
    const bar = el('div', { className: 'chart-bar' });
    bar.style.height = Math.max(2, (d.total / max) * 100) + '%';
    col.appendChild(bar);
    col.appendChild(el('div', { className: 'chart-lbl' }, d.label));
    wrap.appendChild(col);
  });
  return wrap;
}

export function distributionBars(entries) {
  // entries: [[label, value], ...]
  const wrap = el('div');
  const max = Math.max(...entries.map(([, v]) => v), 1);
  entries.forEach(([label, value]) => {
    const row = el('div', { className: 'dist-row' });
    row.innerHTML = `<div class="dist-head"><span>${label}</span><span class="mono">${value.toFixed(1)}</span></div>
      <div class="dist-track"><div class="dist-fill" style="width:${(value / max) * 100}%;"></div></div>`;
    wrap.appendChild(row);
  });
  return wrap;
}

// "2026-07" -> "July 2026"
export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

// Generates and downloads a one-page PDF fee receipt using jsPDF (loaded via CDN in index.html).
export function downloadFeeReceipt(student, monthKey, entry, settings) {
  if (!window.jspdf) { alert('PDF library did not load — check your internet connection and try again.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: [340, 460] });
  const monthText = monthLabel(monthKey);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text(settings.libraryName || 'Career Library', 170, 50, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text(settings.address || '', 170, 68, { align: 'center' });

  doc.setDrawColor(200); doc.line(30, 85, 310, 85);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('Fee Payment Receipt', 170, 110, { align: 'center' });

  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  const rows = [
    ['Student Name', student.name],
    ['Roll Number', student.roll],
    ['Exam Target', student.examTarget],
    ['Month', monthText],
    ['Amount Paid', 'Rs. ' + entry.amount],
    ['Payment Date', entry.paidDate || '-'],
    ['Status', 'PAID']
  ];
  let y = 145;
  rows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold'); doc.text(label + ':', 40, y);
    doc.setFont('helvetica', 'normal'); doc.text(String(value), 160, y);
    y += 24;
  });

  doc.setDrawColor(200); doc.line(30, y + 5, 310, y + 5);
  doc.setFontSize(9); doc.setTextColor(120);
  doc.text('This is a computer-generated receipt.', 170, y + 25, { align: 'center' });

  doc.save(`Receipt-${student.roll}-${monthKey}.pdf`);
}

// Generates and downloads ONE PDF containing every student's full record:
// profile, join date, months enrolled, seat, and complete month-by-month fee history.
// Uses jsPDF + the autoTable plugin (both loaded via CDN in index.html).
export function downloadAllStudentsPDF(students, seats, settings) {
  if (!window.jspdf) { alert('PDF library did not load — check your internet connection and try again.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  if (typeof doc.autoTable !== 'function') { alert('PDF table library did not load — check your internet connection and try again.'); return; }
  const pageWidth = doc.internal.pageSize.getWidth();
  const today = new Date();

  // "How many months" since joining — counts the joining month itself as month 1.
  function monthsSince(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    let months = (today.getFullYear() - d.getFullYear()) * 12 + (today.getMonth() - d.getMonth());
    if (today.getDate() < d.getDate()) months -= 1;
    return Math.max(0, months) + 1;
  }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text(settings.libraryName || 'Library', pageWidth / 2, 40, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text(settings.address || '', pageWidth / 2, 56, { align: 'center' });
  doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.text('All Student Records', pageWidth / 2, 78, { align: 'center' });
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(120);
  doc.text('Generated ' + today.toLocaleString('en-IN'), pageWidth / 2, 92, { align: 'center' });
  doc.setTextColor(0);

  // ---- Summary table: one row per student ----
  const summaryRows = students.map(s => {
    const seat = seats.find(se => se.occupantId === s.id);
    return [
      s.roll, s.name, s.phone || '—', s.gender, s.examTarget,
      s.joinDate || '—', monthsSince(s.joinDate), seat ? '#' + seat.seatNo : '—',
      'Rs. ' + (s.feeAmount || 0), s.feeStatus === 'claimed' ? 'pending' : (s.feeStatus || '—')
    ];
  });

  doc.autoTable({
    startY: 105,
    head: [['Roll', 'Name', 'Phone', 'Gender', 'Exam Target', 'Joined', 'Months', 'Seat', 'Fee/mo', 'Status']],
    body: summaryRows,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [242, 184, 75], textColor: [26, 19, 0] },
    margin: { left: 28, right: 28 }
  });

  // ---- Detailed month-by-month fee history for every student ----
  let y = doc.lastAutoTable.finalY + 22;
  if (y > 740) { doc.addPage(); y = 40; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  doc.text('Fee Payment History — All Months, All Students', 28, y);

  const historyRows = [];
  students.forEach(s => {
    const feeHistory = s.feeHistory || {};
    Object.keys(feeHistory).sort().forEach(key => {
      const entry = feeHistory[key];
      historyRows.push([
        s.roll, s.name, monthLabel(key), 'Rs. ' + entry.amount,
        entry.status === 'claimed' ? 'pending review' : entry.status,
        entry.paidDate || '—'
      ]);
    });
  });

  doc.autoTable({
    startY: y + 10,
    head: [['Roll', 'Name', 'Month', 'Amount', 'Status', 'Paid Date']],
    body: historyRows.length ? historyRows : [['—', '—', 'No fee records yet', '—', '—', '—']],
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [38, 43, 56], textColor: [255, 255, 255] },
    margin: { left: 28, right: 28 }
  });

  doc.save(`All-Student-Records-${today.toISOString().slice(0, 10)}.pdf`);
}
