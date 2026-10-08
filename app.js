const STORAGE_KEY = "northstar-examsys-v1";
const ADMIN_EMAIL = "admin@examsys.local";
const ADMIN_PASSWORD = "admin123";
const DEMO_TEACHER_EMAIL = "teacher@examsys.local";
const DEMO_TEACHER_PASSWORD = "teach123";
const app = document.querySelector("#app");

const now = () => new Date();
const localInputDate = (date) => {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
};
const isoAfterMinutes = (minutes) => new Date(Date.now() + minutes * 60000).toISOString();
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const initials = (name = "U") => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
const formatDate = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const sameCourse = (first, second) => String(first).trim().toLowerCase() === String(second).trim().toLowerCase();

function seedData() {
  const start = new Date(Date.now() - 30 * 60000);
  const end = new Date(Date.now() + 120 * 60000);
  return {
    settings: { schoolName: "", defaultDuration: 30 },
    teachers: [{ id: "teacher-demo", name: "Mara Santos", email: DEMO_TEACHER_EMAIL, password: DEMO_TEACHER_PASSWORD, approved: true, createdAt: new Date().toISOString() }],
    students: [],
    exams: [
      {
        id: "exam-demo-live", title: "Foundations of Computing", year: "3rd Year", course: "BSIT", startAt: start.toISOString(), endAt: end.toISOString(), duration: 30, allowLate: false, teacherId: "teacher-demo", createdAt: new Date().toISOString(),
        questions: [
          { prompt: "Which component executes instructions in a computer?", choices: ["CPU", "Monitor", "Keyboard", "Power supply"], correct: 0 },
          { prompt: "What does HTML primarily define?", choices: ["Network routing", "Web page structure", "Database indexes", "Operating system permissions"], correct: 1 },
          { prompt: "Which data structure follows FIFO order?", choices: ["Stack", "Tree", "Queue", "Graph"], correct: 2 },
          { prompt: "What is the binary representation of decimal 5?", choices: ["101", "110", "111", "100"], correct: 0 }
        ]
      },
      {
        id: "exam-demo-closed", title: "Intro to Data Literacy", year: "2nd Year", course: "BSIT", startAt: isoAfterMinutes(-210), endAt: isoAfterMinutes(-30), duration: 20, allowLate: false, teacherId: "teacher-demo", createdAt: new Date().toISOString(),
        questions: [{ prompt: "Which measure represents the middle value in an ordered data set?", choices: ["Mean", "Median", "Mode", "Range"], correct: 1 }]
      }
    ],
    attempts: []
  };
}

function readData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      data.settings ||= { schoolName: "", defaultDuration: 30 };
      return data;
    }
  } catch (error) {
    console.warn("Could not load saved exam data.", error);
  }
  const initial = seedData();
  writeData(initial);
  return initial;
}
function writeData(data = state.data) {
  state.data = data;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const state = {
  data: null,
  user: null,
  roleChoice: "student",
  authMode: "login",
  activeView: "overview",
  message: "",
  messageType: "error",
  draftQuestionCount: 1,
  attemptId: null,
  questionIndex: 0,
  toastTimer: null
};
state.data = readData();

function showMessage(text, type = "error") {
  state.message = text;
  state.messageType = type;
}
function clearMessage() { state.message = ""; }
function showToast(text) {
  const oldToast = document.querySelector(".toast");
  if (oldToast) oldToast.remove();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.textContent = text;
  document.body.append(toast);
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.remove(), 3000);
}
function teacherFor(exam) {
  return state.data.teachers.find((teacher) => teacher.id === exam.teacherId);
}
function studentAttempt(examId, studentId) {
  return state.data.attempts.find((attempt) => attempt.examId === examId && attempt.studentId === studentId);
}
function matchingExams(student) {
  return state.data.exams.filter((exam) => exam.year === student.year && sameCourse(exam.course, student.course)).sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
}
function examStatus(exam, attempt) {
  if (attempt?.submittedAt) return { label: "Completed", kind: "neutral" };
  if (attempt && new Date(attempt.expiresAt) <= now()) return { label: "Time expired", kind: "closed" };
  if (attempt) return { label: "In progress", kind: "open" };
  const current = now();
  if (exam.allowLate) return { label: "Reopened", kind: "open" };
  if (current < new Date(exam.startAt)) return { label: "Scheduled", kind: "scheduled" };
  if (current > new Date(exam.endAt)) return { label: "Closed", kind: "closed" };
  return { label: "Available", kind: "open" };
}
function canStart(exam, attempt) {
  if (attempt) return !attempt.submittedAt && new Date(attempt.expiresAt) > now();
  return exam.allowLate || (now() >= new Date(exam.startAt) && now() <= new Date(exam.endAt));
}
function visibleExamsForUser() {
  if (state.user.role === "student") return matchingExams(state.user);
  return state.data.exams.filter((exam) => state.user.role === "admin" || exam.teacherId === state.user.id).sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
}

function brand() {
  return '<div class="brand"><span class="brand-mark" aria-hidden="true">E</span><span>EXAMORA</span></div>';
}
function renderAuth() {
  const isStudent = state.roleChoice === "student";
  const registration = state.authMode === "register";
  const message = state.message ? `<div class="message ${state.messageType === "success" ? "success" : ""}" role="alert">${escapeHtml(state.message)}</div>` : "";
  const roleControls = `<div class="role-switch" role="tablist" aria-label="Choose login role">
    <button type="button" data-role-choice="student" class="${isStudent ? "active" : ""}" role="tab" aria-selected="${isStudent}">Student</button>
    <button type="button" data-role-choice="staff" class="${!isStudent ? "active" : ""}" role="tab" aria-selected="${!isStudent}">Teacher / Admin</button>
  </div>`;
  let form = "";
  if (isStudent) {
    form = `<form class="form-stack" data-form="student-login">
      <div class="field"><label for="student-id">Student ID number</label><input id="student-id" name="studentId" required maxlength="40" placeholder="e.g. 2024-01842" autocomplete="username"></div>
      <div class="field"><label for="student-name">Full name</label><input id="student-name" name="name" required maxlength="100" placeholder="Name as listed by your school" autocomplete="name"></div>
      <div class="form-grid">
        <div class="field"><label for="student-year">Year level</label><select id="student-year" name="year" required><option value="">Choose year</option>${["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"].map((year) => `<option>${year}</option>`).join("")}</select></div>
        <div class="field"><label for="student-course">Course</label><input id="student-course" name="course" required maxlength="60" placeholder="e.g. BSIT"></div>
      </div>
      <button class="button full" type="submit">Continue to my exams <span aria-hidden="true">→</span></button>
    </form>`;
  } else if (registration) {
    form = `<form class="form-stack" data-form="teacher-register">
      <div class="field"><label for="register-name">Full name</label><input id="register-name" name="name" required maxlength="100" autocomplete="name"></div>
      <div class="field"><label for="register-email">School email</label><input id="register-email" name="email" type="email" required maxlength="160" autocomplete="email"></div>
      <div class="field"><label for="register-password">Password</label><input id="register-password" name="password" type="password" required minlength="6" autocomplete="new-password"></div>
      <button class="button full" type="submit">Request teacher access</button>
      <button class="text-button" type="button" data-auth-mode="login">Back to staff login</button>
    </form>`;
  } else {
    form = `<form class="form-stack" data-form="staff-login">
      <div class="field"><label for="staff-role">Sign in as</label><select id="staff-role" name="staffRole"><option value="teacher">Teacher</option><option value="admin">Admin</option></select></div>
      <div class="field"><label for="staff-email">Email or username</label><input id="staff-email" name="email" type="text" required autocomplete="username" placeholder="name@school.edu or admin"></div>
      <div class="field"><label for="staff-password">Password</label><input id="staff-password" name="password" type="password" required autocomplete="current-password"></div>
      <button class="button full" type="submit">Sign in <span aria-hidden="true">→</span></button>
      <button class="text-button" type="button" data-auth-mode="register">Register as a teacher</button>
    </form>`;
  }
  app.innerHTML = `<main class="auth-shell">
    <aside class="auth-aside">${brand()}<div class="aside-copy"><p class="eyebrow">Academic assessment</p><h1>Your exam schedule, by class.</h1><p>Exam access is matched to your year and course, then kept within the time window set by your teacher.</p><div class="auth-facts"><div class="auth-fact"><span class="auth-fact-index">01</span><div><strong>Student access</strong><p>Sign in with your school ID, year level, and course.</p></div></div><div class="auth-fact"><span class="auth-fact-index">02</span><div><strong>Teacher access</strong><p>New teacher accounts are reviewed by an admin.</p></div></div><div class="auth-fact"><span class="auth-fact-index">03</span><div><strong>Exam window</strong><p>Each exam opens and closes at its scheduled time.</p></div></div></div></div><div class="aside-foot">EXAMORA · Digital Examination Management System</div></aside>
    <section class="auth-main"><div class="auth-card"><p class="eyebrow">${registration ? "Teacher registration" : isStudent ? "Student access" : "Staff access"}</p><h2>${isStudent ? "Student sign in" : registration ? "Register as a teacher" : "Staff sign in"}</h2><p class="auth-lead">${isStudent ? "Use the details on your school ID. Your exam list is based on the year and course you enter." : registration ? "Send a teacher access request. An admin must approve it before you can manage exams." : "Choose your role, then sign in with the email and password for your account."}</p>${roleControls}${message}${form}
    </div></section>
  </main>`;
}

const navForRole = {
  student: [{ id: "overview", icon: "⌂", label: "Dashboard" }, { id: "available", icon: "▤", label: "Available Exams" }, { id: "upcoming", icon: "◷", label: "Upcoming" }, { id: "history", icon: "↻", label: "Exam History" }, { id: "results", icon: "▧", label: "Results" }, { id: "profile", icon: "♙", label: "Profile" }],
  teacher: [{ id: "overview", icon: "⌂", label: "Overview" }, { id: "monitoring", icon: "◉", label: "Monitor" }, { id: "leaderboard", icon: "★", label: "Leaderboard" }, { id: "reports", icon: "▧", label: "Reports" }, { id: "exams", icon: "▤", label: "Exams" }, { id: "students", icon: "♙", label: "Students" }],
  admin: [{ id: "overview", icon: "⌂", label: "Dashboard" }, { id: "users", icon: "♙", label: "Users" }, { id: "students", icon: "♧", label: "Students" }, { id: "exams", icon: "▤", label: "Exams" }, { id: "questions", icon: "≡", label: "Questions" }, { id: "monitoring", icon: "◉", label: "Monitor" }, { id: "leaderboard", icon: "★", label: "Leaderboard" }, { id: "reports", icon: "▧", label: "Reports" }, { id: "settings", icon: "⚙", label: "Settings" }, { id: "approvals", icon: "✓", label: "Approvals" }]
};
function pageTitle(view) {
  return ({ overview: state.user.role === "teacher" ? "Overview" : "Dashboard", available: "Available exams", upcoming: "Upcoming exams", history: "Exam history", profile: "My profile", monitoring: "Exam monitoring", leaderboard: "Leaderboard", reports: "Class reports", exams: state.user.role === "student" ? "My exams" : "Exam management", users: "Users", questions: "Questions", settings: "Settings", students: "Students", approvals: "Teacher approvals", results: "Exam results" })[view] || "Overview";
}
function shell(content) {
  const user = state.user;
  const nav = navForRole[user.role].map((item) => `<button class="nav-item ${state.activeView === item.id ? "active" : ""}" type="button" data-view="${item.id}" aria-current="${state.activeView === item.id ? "page" : "false"}"><span class="nav-icon" aria-hidden="true">${item.icon}</span><span>${item.label}</span></button>`).join("");
  const roleLabel = user.role === "admin" ? "Administrator" : user.role === "teacher" ? "Teacher" : `${escapeHtml(user.year)} · ${escapeHtml(user.course)}`;
  app.innerHTML = `<div class="app-shell"><aside class="sidebar">${brand()}<p class="sidebar-label">Workspace</p><nav class="nav-list" aria-label="Main navigation">${nav}</nav><div class="sidebar-bottom"><div class="profile-mini"><div class="avatar">${escapeHtml(initials(user.name))}</div><div><strong>${escapeHtml(user.name)}</strong><span>${roleLabel}</span></div></div><button class="button logout" type="button" data-action="logout"><span aria-hidden="true">↪</span><span class="logout-label">${user.role === "admin" ? "Logout" : "Sign out"}</span></button></div></aside><main class="main-area"><header class="topbar"><span class="topbar-kicker">${escapeHtml(pageTitle(state.activeView))}</span><span class="topbar-date">${new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(now())}</span></header><section class="content">${content}</section></main></div>`;
}
function heading(title, description, action = "") {
  return `<div class="page-heading"><div><p class="eyebrow">${state.user.role === "admin" ? "Administration" : state.user.role === "teacher" ? "Teaching workspace" : "Student workspace"}</p><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
}
function stat(label, value) { return `<div class="stat-card"><span>${label}</span><strong>${value}</strong></div>`; }
function examAction(exam, attempt) {
  if (canStart(exam, attempt)) return `<button class="button small" type="button" data-action="open-exam" data-id="${escapeHtml(exam.id)}">${attempt ? "Resume exam" : "Start exam"} <span aria-hidden="true">→</span></button>`;
  return "";
}
function examRow(exam, student = state.user) {
  const attempt = student.role === "student" ? studentAttempt(exam.id, student.id) : null;
  const status = examStatus(exam, attempt);
  const creator = teacherFor(exam);
  return `<tr><td data-label="Exam"><strong>${escapeHtml(exam.title)}</strong><span class="sub-cell">${escapeHtml(exam.year)} · ${escapeHtml(exam.course)}${creator ? ` · ${escapeHtml(creator.name)}` : ""}</span></td><td data-label="Schedule">${formatDate(exam.startAt)}<span class="sub-cell">Closes ${formatDate(exam.endAt)}</span></td><td data-label="Length">${exam.duration} min</td><td data-label="Status"><span class="badge ${status.kind === "open" ? "" : status.kind}">${status.label}</span></td><td data-label="Action">${examAction(exam, attempt)}</td></tr>`;
}
function examTable(exams, student = state.user) {
  if (!exams.length) return '<div class="empty-state">No exams match your year and course yet.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>Exam</th><th>Schedule</th><th>Length</th><th>Status</th><th></th></tr></thead><tbody>${exams.map((exam) => examRow(exam, student)).join("")}</tbody></table></div>`;
}
function studentOverview() {
  const exams = matchingExams(state.user);
  const attempts = state.data.attempts.filter((attempt) => attempt.studentId === state.user.id);
  const available = exams.filter((exam) => canStart(exam, studentAttempt(exam.id, state.user.id))).length;
  return `${heading(`Hi, ${escapeHtml(state.user.name.split(" ")[0])}.`, `${escapeHtml(state.user.year)} · ${escapeHtml(state.user.course)} · Student ID ${escapeHtml(state.user.studentId)}`)}
    <div class="welcome-banner"><div><p class="eyebrow">Your exam schedule</p><h2>Here's what is coming up.</h2><p>Exams for ${escapeHtml(state.user.year)} ${escapeHtml(state.user.course)} appear below. Check the closing time before you begin.</p></div><span class="banner-mark" aria-hidden="true">E</span></div>
    <div class="stat-grid">${stat("MATCHING EXAMS", exams.length)}${stat("READY TO TAKE", available)}${stat("COMPLETED", attempts.filter((attempt) => attempt.submittedAt).length)}</div>
    <div class="section-title"><div><h2>Upcoming and active</h2><p>Exam access closes at the scheduled end time unless staff reopens it.</p></div><button class="text-button" type="button" data-view="exams">View all →</button></div>${examTable(exams.slice(0, 4))}`;
}
function studentExams() {
  const exams = matchingExams(state.user);
  return `${heading("Exams for you", `${escapeHtml(state.user.year)} · ${escapeHtml(state.user.course)}. Only matching exams appear here.`)}${examTable(exams)}`;
}
function studentAvailableExams() {
  const exams = matchingExams(state.user).filter((exam) => canStart(exam, studentAttempt(exam.id, state.user.id)));
  return `${heading("Available exams", "These exams are open now or have been reopened by your teacher.")}${examTable(exams)}`;
}
function studentUpcomingExams() {
  const exams = matchingExams(state.user).filter((exam) => !studentAttempt(exam.id, state.user.id) && !exam.allowLate && new Date(exam.startAt) > now());
  return `${heading("Upcoming exams", "Check the opening time so you know when to come back.")}${examTable(exams)}`;
}
function studentHistory() {
  const exams = matchingExams(state.user).filter((exam) => {
    const attempt = studentAttempt(exam.id, state.user.id);
    return Boolean(attempt?.submittedAt || (attempt && new Date(attempt.expiresAt) <= now()) || (!exam.allowLate && new Date(exam.endAt) < now()));
  });
  return `${heading("Exam history", "Completed exams and exams whose access window has closed.")}${examTable(exams)}`;
}
function studentProfile() {
  const student = state.user;
  return `${heading("My profile", "Check that these details match your school records.")}<section class="panel profile-panel"><div class="profile-large"><div class="avatar">${escapeHtml(initials(student.name))}</div><div><h2>${escapeHtml(student.name)}</h2><p>${escapeHtml(student.year)} · ${escapeHtml(student.course)}</p></div></div><dl class="profile-details"><div><dt>Student ID number</dt><dd>${escapeHtml(student.studentId)}</dd></div><div><dt>Year level</dt><dd>${escapeHtml(student.year)}</dd></div><div><dt>Course</dt><dd>${escapeHtml(student.course)}</dd></div></dl></section>`;
}
function studentResults() {
  const results = state.data.attempts.filter((attempt) => attempt.studentId === state.user.id && attempt.submittedAt).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  const rows = results.map((attempt) => {
    const exam = state.data.exams.find((item) => item.id === attempt.examId);
    if (!exam) return "";
    return `<tr><td data-label="Exam"><strong>${escapeHtml(exam.title)}</strong><span class="sub-cell">${escapeHtml(exam.course)} · ${escapeHtml(exam.year)}</span></td><td data-label="Submitted">${formatDate(attempt.submittedAt)}</td><td data-label="Score"><strong>${attempt.score} / ${exam.questions.length}</strong></td><td data-label="Percent">${Math.round(attempt.score / exam.questions.length * 100)}%</td></tr>`;
  }).join("");
  return `${heading("Your results", "Submitted exam scores are recorded here.")}${results.length ? `<div class="table-wrap"><table><thead><tr><th>Exam</th><th>Submitted</th><th>Score</th><th>Percent</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty-state">You do not have any submitted exam results yet.</div>'}`;
}
function examsForStaff() {
  const exams = visibleExamsForUser();
  const cards = exams.length ? exams.map((exam) => {
    const status = examStatus(exam, null);
    const teacher = teacherFor(exam);
    return `<article class="exam-card"><div><h3>${escapeHtml(exam.title)}</h3><div class="exam-meta"><span>${escapeHtml(exam.year)} · ${escapeHtml(exam.course)}</span><span>${formatDate(exam.startAt)} to ${formatDate(exam.endAt)}</span><span>${exam.questions.length} questions · ${exam.duration} minutes</span>${teacher ? `<span>By ${escapeHtml(teacher.name)}</span>` : ""}<span class="badge ${status.kind === "open" ? "" : status.kind}">${exam.allowLate ? "Late access open" : status.label}</span></div></div><div class="exam-actions"><button class="button small ${exam.allowLate ? "danger" : "secondary"}" type="button" data-action="toggle-override" data-id="${escapeHtml(exam.id)}">${exam.allowLate ? "Close late access" : "Reopen for late students"}</button></div></article>`;
  }).join("") : '<div class="empty-state">No exams have been created. Add the first exam using the form.</div>';
  return `${heading("Exam management", state.user.role === "admin" ? "Create and manage exams across all courses." : "Create exams for your students and manage late access.")}
    <div class="split-layout"><section><div class="section-title" style="margin-top:0"><div><h2>Your exams</h2><p>Reopening late access bypasses the scheduled window for students who have not submitted.</p></div></div>${cards}</section><section class="panel"><h2>Create an exam</h2><p class="field-help" style="margin:-7px 0 15px">Choose the student year/course, exam window, duration, and correct answer for each question.</p>${examBuilder()}</section></div>`;
}
function examBuilder() {
  const questionBlocks = Array.from({ length: state.draftQuestionCount }, (_, index) => `<div class="question-editor" data-question-index="${index}"><div class="question-editor-head"><span>Question ${index + 1}</span>${index > 0 ? `<button class="text-button" type="button" data-action="remove-question" data-index="${index}">Remove</button>` : ""}</div><div class="field"><label for="prompt-${index}">Question</label><textarea id="prompt-${index}" name="prompt-${index}" required maxlength="500" placeholder="Write a clear question"></textarea></div><div class="choice-grid">${["A", "B", "C", "D"].map((letter, choice) => `<label class="choice-input"><span>${letter}</span><input name="choice-${index}-${choice}" required maxlength="200" placeholder="Answer option ${letter}"></label>`).join("")}</div><label class="correct-pick">Correct answer <select name="correct-${index}" aria-label="Correct answer for question ${index + 1}">${["A", "B", "C", "D"].map((letter, choice) => `<option value="${choice}">${letter}</option>`).join("")}</select></label></div>`).join("");
  return `<form class="exam-form" data-form="create-exam"><div class="field"><label for="exam-title">Exam title</label><input id="exam-title" name="title" required maxlength="100" placeholder="e.g. Midterm: Web Development"></div><div class="form-grid"><div class="field"><label for="exam-year">Year level</label><select id="exam-year" name="year" required>${["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"].map((year) => `<option>${year}</option>`).join("")}</select></div><div class="field"><label for="exam-course">Course</label><input id="exam-course" name="course" required maxlength="60" placeholder="e.g. BSIT"></div></div><div class="form-grid"><div class="field"><label for="exam-start">Opens at</label><input id="exam-start" type="datetime-local" name="startAt" required value="${localInputDate(now())}"></div><div class="field"><label for="exam-end">Closes at</label><input id="exam-end" type="datetime-local" name="endAt" required value="${localInputDate(new Date(Date.now() + 60 * 60000))}"></div></div><div class="field"><label for="exam-duration">Time limit (minutes)</label><input id="exam-duration" name="duration" type="number" min="1" max="300" value="${Number(state.data.settings?.defaultDuration) || 30}" required></div><div><div class="section-title" style="margin:5px 0 10px"><div><h3 style="margin:0;font-size:17px">Questions</h3><p>Add multiple-choice questions with four answer options.</p></div></div><div class="exam-form">${questionBlocks}</div></div><div class="form-actions"><button class="button secondary small" type="button" data-action="add-question">＋ Add question</button><button class="button" type="submit">Publish exam</button></div></form>`;
}
function studentsPage() {
  const students = [...state.data.students].sort((a, b) => a.name.localeCompare(b.name));
  const rows = students.map((student) => `<tr><td data-label="Student"><strong>${escapeHtml(student.name)}</strong></td><td data-label="ID number">${escapeHtml(student.studentId)}</td><td data-label="Year">${escapeHtml(student.year)}</td><td data-label="Course">${escapeHtml(student.course)}</td><td data-label="Completed">${state.data.attempts.filter((attempt) => attempt.studentId === student.id && attempt.submittedAt).length}</td></tr>`).join("");
  return `${heading("Student directory", "Student accounts are created when a student signs in with their school details.")}${rows ? `<div class="table-wrap"><table><thead><tr><th>Student</th><th>ID number</th><th>Year</th><th>Course</th><th>Completed</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty-state">Student accounts will appear here after their first sign-in.</div>'}`;
}
function adminUsersPage() {
  const accounts = [
    { name: "System Admin", email: ADMIN_EMAIL, role: "Administrator", status: "Active" },
    ...state.data.teachers.map((teacher) => ({ name: teacher.name, email: teacher.email, role: "Teacher", status: teacher.approved ? "Approved" : "Awaiting approval" }))
  ];
  const rows = accounts.map((account) => `<tr><td data-label="Name"><strong>${escapeHtml(account.name)}</strong></td><td data-label="Email">${escapeHtml(account.email)}</td><td data-label="Role">${account.role}</td><td data-label="Status"><span class="badge ${account.status === "Awaiting approval" ? "scheduled" : ""}">${account.status}</span></td></tr>`).join("");
  return `${heading("Users", "Staff accounts and their access status.")}<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function adminQuestionsPage() {
  const questions = visibleExamsForUser().flatMap((exam) => exam.questions.map((question, index) => ({ exam, question, index })));
  const rows = questions.map(({ exam, question, index }) => `<tr><td data-label="Exam"><strong>${escapeHtml(exam.title)}</strong><span class="sub-cell">${escapeHtml(exam.year)} · ${escapeHtml(exam.course)}</span></td><td data-label="Question">${index + 1}. ${escapeHtml(question.prompt)}</td><td data-label="Correct answer">${escapeHtml(question.choices[question.correct] || "-")}</td></tr>`).join("");
  return `${heading("Questions", "Review exam questions and answer keys.")}${rows ? `<div class="table-wrap"><table><thead><tr><th>Exam</th><th>Question</th><th>Correct answer</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty-state">Questions will appear here after an exam is published.</div>'}`;
}
function adminSettingsPage() {
  const settings = state.data.settings || { schoolName: "", defaultDuration: 30 };
  return `${heading("Settings", "Set your school name and the default time limit for new exams.")}<section class="panel settings-panel"><form class="form-stack" data-form="admin-settings"><div class="field"><label for="school-name">School or campus name</label><input id="school-name" name="schoolName" maxlength="100" value="${escapeHtml(settings.schoolName || "")}" placeholder="e.g. North Valley College"></div><div class="field"><label for="default-duration">Default exam duration (minutes)</label><input id="default-duration" name="defaultDuration" type="number" min="1" max="300" value="${Number(settings.defaultDuration) || 30}" required></div><button class="button" type="submit">Save settings</button></form></section>`;
}
function studentsForExam(exam) {
  return state.data.students.filter((student) => student.year === exam.year && sameCourse(student.course, exam.course));
}
function attemptStatusForRoster(exam, attempt) {
  if (attempt?.submittedAt) return { label: "Completed", kind: "neutral" };
  if (attempt && new Date(attempt.expiresAt) <= now()) return { label: "Time expired", kind: "closed" };
  if (attempt) return { label: "In progress", kind: "open" };
  if (!exam.allowLate && now() > new Date(exam.endAt)) return { label: "Missed", kind: "closed" };
  return { label: "Not started", kind: "scheduled" };
}
function teacherMonitoring() {
  const exams = visibleExamsForUser();
  if (!exams.length) return `${heading("Exam monitoring", "See who has started, submitted, or missed each exam.")}<div class="empty-state">Create an exam first. Its matching students will appear here.</div>`;
  const records = exams.flatMap((exam) => studentsForExam(exam).map((student) => ({ exam, student, attempt: studentAttempt(exam.id, student.id), status: attemptStatusForRoster(exam, studentAttempt(exam.id, student.id)) })));
  const inProgress = records.filter((record) => record.status.label === "In progress").length;
  const completed = records.filter((record) => record.status.label === "Completed").length;
  const waiting = records.filter((record) => record.status.label === "Not started").length;
  const cards = exams.map((exam) => {
    const examRecords = records.filter((record) => record.exam.id === exam.id);
    const rows = examRecords.map(({ student, attempt, status }) => {
      const answered = Object.keys(attempt?.answers || {}).length;
      const progress = attempt && !attempt.submittedAt ? `${answered} / ${exam.questions.length} answered` : attempt?.submittedAt ? `${attempt.score} / ${exam.questions.length}` : "-";
      const activity = attempt?.submittedAt ? formatDate(attempt.submittedAt) : attempt?.startedAt ? formatDate(attempt.startedAt) : "-";
      return `<tr><td data-label="Student"><strong>${escapeHtml(student.name)}</strong></td><td data-label="ID number">${escapeHtml(student.studentId)}</td><td data-label="Status"><span class="badge ${status.kind}">${status.label}</span></td><td data-label="Progress">${progress}</td><td data-label="Last activity">${activity}</td></tr>`;
    }).join("");
    return `<section class="monitor-section"><div class="section-title"><div><h2>${escapeHtml(exam.title)}</h2><p>${escapeHtml(exam.year)} · ${escapeHtml(exam.course)} · Closes ${formatDate(exam.endAt)}</p></div><span class="badge neutral">${examRecords.length} students</span></div>${rows ? `<div class="table-wrap"><table><thead><tr><th>Student</th><th>ID number</th><th>Status</th><th>Progress / score</th><th>Last activity</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty-state">No student accounts match this exam yet.</div>'}</section>`;
  }).join("");
  return `${heading("Exam monitoring", "Check each class roster for students taking, finishing, or missing an exam.")}<div class="stat-grid">${stat("IN PROGRESS", inProgress)}${stat("COMPLETED", completed)}${stat("NOT STARTED", waiting)}</div>${cards}`;
}
function teacherLeaderboard() {
  const exams = visibleExamsForUser();
  const cards = exams.map((exam) => {
    const ranked = state.data.attempts.filter((attempt) => attempt.examId === exam.id && attempt.submittedAt).map((attempt) => ({ attempt, student: state.data.students.find((item) => item.id === attempt.studentId) })).filter((entry) => entry.student).sort((first, second) => {
      const firstPercent = first.attempt.score / exam.questions.length;
      const secondPercent = second.attempt.score / exam.questions.length;
      return secondPercent - firstPercent || second.attempt.score - first.attempt.score || new Date(first.attempt.submittedAt) - new Date(second.attempt.submittedAt);
    });
    const rows = ranked.map(({ attempt, student }, index) => `<tr><td data-label="Rank"><span class="rank-number">${index + 1}</span></td><td data-label="Student"><strong>${escapeHtml(student.name)}</strong></td><td data-label="ID number">${escapeHtml(student.studentId)}</td><td data-label="Score"><strong>${attempt.score} / ${exam.questions.length}</strong></td><td data-label="Result">${Math.round(attempt.score / exam.questions.length * 100)}%</td><td data-label="Submitted">${formatDate(attempt.submittedAt)}</td></tr>`).join("");
    return `<section class="monitor-section"><div class="section-title"><div><h2>${escapeHtml(exam.title)}</h2><p>${escapeHtml(exam.year)} · ${escapeHtml(exam.course)}</p></div><span class="badge neutral">${ranked.length} submitted</span></div>${rows ? `<div class="table-wrap"><table><thead><tr><th>Rank</th><th>Student</th><th>ID number</th><th>Score</th><th>Result</th><th>Submitted</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty-state">No completed attempts to rank yet.</div>'}</section>`;
  }).join("");
  return `${heading("Leaderboard", "Students are ranked by percentage for each exam. Ties go to the earlier submission.")}${cards || '<div class="empty-state">Create an exam to start a class leaderboard.</div>'}`;
}
function teacherReportRows() {
  return visibleExamsForUser().flatMap((exam) => studentsForExam(exam).map((student) => {
    const attempt = studentAttempt(exam.id, student.id);
    const status = attemptStatusForRoster(exam, attempt);
    return { exam, student, attempt, status };
  }));
}
function teacherReports() {
  const exams = visibleExamsForUser();
  const reportRows = teacherReportRows();
  const submitted = reportRows.filter((record) => record.attempt?.submittedAt);
  const average = submitted.length ? Math.round(submitted.reduce((total, record) => total + record.attempt.score / record.exam.questions.length * 100, 0) / submitted.length) : 0;
  const rows = exams.map((exam) => {
    const examRows = reportRows.filter((record) => record.exam.id === exam.id);
    const completed = examRows.filter((record) => record.attempt?.submittedAt);
    const active = examRows.filter((record) => record.status.label === "In progress").length;
    const averageScore = completed.length ? `${Math.round(completed.reduce((total, record) => total + record.attempt.score / exam.questions.length * 100, 0) / completed.length)}%` : "-";
    const participation = examRows.length ? `${Math.round(completed.length / examRows.length * 100)}%` : "-";
    return `<tr><td data-label="Exam"><strong>${escapeHtml(exam.title)}</strong><span class="sub-cell">${escapeHtml(exam.year)} · ${escapeHtml(exam.course)}</span></td><td data-label="Roster">${examRows.length}</td><td data-label="Completed">${completed.length}</td><td data-label="In progress">${active}</td><td data-label="Average">${averageScore}</td><td data-label="Participation">${participation}</td></tr>`;
  }).join("");
  const exportButton = exams.length ? '<button class="button secondary" type="button" data-action="download-report">Download CSV</button>' : "";
  return `${heading("Class reports", "Review participation and average scores for the exams you created.", exportButton)}<div class="stat-grid">${stat("EXAMS", exams.length)}${stat("SUBMISSIONS", submitted.length)}${stat("OVERALL AVERAGE", submitted.length ? `${average}%` : "-")}</div>${rows ? `<div class="table-wrap"><table><thead><tr><th>Exam</th><th>Roster</th><th>Completed</th><th>In progress</th><th>Average score</th><th>Participation</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty-state">Create an exam to see class reports here.</div>'}`;
}
function downloadTeacherReport() {
  if (state.user?.role !== "teacher") return;
  const headers = ["School", "Exam", "Year", "Course", "Student ID", "Student name", "Status", "Score", "Total questions", "Percent", "Started", "Submitted"];
  const rows = teacherReportRows().map(({ exam, student, attempt, status }) => [state.data.settings?.schoolName || "", exam.title, exam.year, exam.course, student.studentId, student.name, status.label, attempt?.submittedAt ? attempt.score : "", exam.questions.length, attempt?.submittedAt ? `${Math.round(attempt.score / exam.questions.length * 100)}%` : "", attempt?.startedAt || "", attempt?.submittedAt || ""]);
  const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `examora-class-report-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function approvalsPage() {
  const pending = state.data.teachers.filter((teacher) => !teacher.approved);
  const rows = pending.map((teacher) => `<tr><td data-label="Applicant"><strong>${escapeHtml(teacher.name)}</strong><span class="sub-cell">${escapeHtml(teacher.email)}</span></td><td data-label="Requested">${formatDate(teacher.createdAt)}</td><td data-label="Status"><span class="badge scheduled">Awaiting review</span></td><td data-label="Action"><button class="button small" type="button" data-action="approve-teacher" data-id="${escapeHtml(teacher.id)}">Approve</button></td></tr>`).join("");
  return `${heading("Teacher approvals", "Verify each teacher request before granting access to exam management.")}${pending.length ? `<div class="table-wrap"><table><thead><tr><th>Applicant</th><th>Requested</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty-state">No teacher requests are waiting for approval.</div>'}<div class="section-title"><div><h2>Approved teachers</h2><p>Approved staff can sign in and create exams.</p></div></div>${approvedTeachersTable()}`;
}
function approvedTeachersTable() {
  const teachers = state.data.teachers.filter((teacher) => teacher.approved);
  return `<div class="table-wrap"><table><thead><tr><th>Teacher</th><th>Email</th><th>Status</th></tr></thead><tbody>${teachers.map((teacher) => `<tr><td data-label="Teacher"><strong>${escapeHtml(teacher.name)}</strong></td><td data-label="Email">${escapeHtml(teacher.email)}</td><td data-label="Status"><span class="badge">Approved</span></td></tr>`).join("")}</tbody></table></div>`;
}
function staffOverview() {
  const exams = visibleExamsForUser();
  const teachersPending = state.data.teachers.filter((teacher) => !teacher.approved).length;
  const students = state.user.role === "teacher" ? new Set(exams.flatMap((exam) => studentsForExam(exam).map((student) => student.id))).size : state.data.students.length;
  const available = exams.filter((exam) => examStatus(exam, null).label === "Available" || exam.allowLate).length;
  const extras = state.user.role === "admin" ? stat("TEACHER REQUESTS", teachersPending) : stat("STUDENTS", students);
  const activeExams = exams.filter((exam) => exam.allowLate || examStatus(exam, null).label === "Available" || state.data.attempts.some((attempt) => attempt.examId === exam.id && !attempt.submittedAt && new Date(attempt.expiresAt) > now()));
  const adminActivity = [
    ...state.data.exams.map((exam) => ({ at: exam.createdAt, title: "Exam published", detail: `${exam.title} · ${exam.year} ${exam.course}` })),
    ...state.data.teachers.flatMap((teacher) => [
      { at: teacher.createdAt, title: "Teacher access requested", detail: teacher.name },
      ...(teacher.approvedAt ? [{ at: teacher.approvedAt, title: "Teacher account approved", detail: teacher.name }] : [])
    ]),
    ...state.data.attempts.flatMap((attempt) => {
      const exam = state.data.exams.find((item) => item.id === attempt.examId);
      const student = state.data.students.find((item) => item.id === attempt.studentId);
      if (!exam || !student) return [];
      return [
        { at: attempt.startedAt, title: "Student started an exam", detail: `${student.name} · ${exam.title}` },
        ...(attempt.submittedAt ? [{ at: attempt.submittedAt, title: "Exam submitted", detail: `${student.name} · ${exam.title} · ${attempt.score}/${exam.questions.length}` }] : [])
      ];
    })
  ].filter((item) => item.at).sort((first, second) => new Date(second.at) - new Date(first.at)).slice(0, 6);
  const adminSections = state.user.role === "admin" ? `<div class="section-title"><div><h2>Active examinations</h2><p>Open exams and attempts currently in progress.</p></div></div>${activeExams.length ? `<div class="table-wrap"><table><thead><tr><th>Exam</th><th>Class</th><th>Schedule</th><th>Taking now</th><th>Status</th></tr></thead><tbody>${activeExams.map((exam) => { const taking = state.data.attempts.filter((attempt) => attempt.examId === exam.id && !attempt.submittedAt && new Date(attempt.expiresAt) > now()).length; const status = exam.allowLate ? "Reopened" : examStatus(exam, null).label; return `<tr><td data-label="Exam"><strong>${escapeHtml(exam.title)}</strong></td><td data-label="Class">${escapeHtml(exam.year)} · ${escapeHtml(exam.course)}</td><td data-label="Schedule">${formatDate(exam.startAt)}<span class="sub-cell">Closes ${formatDate(exam.endAt)}</span></td><td data-label="Taking now">${taking}</td><td data-label="Status"><span class="badge ${status === "Reopened" ? "" : examStatus(exam, null).kind}">${status}</span></td></tr>`; }).join("")}</tbody></table></div>` : '<div class="empty-state">There are no exams open right now.</div>'}<div class="section-title"><div><h2>Recent activity</h2><p>Latest exam and account events.</p></div></div>${adminActivity.length ? `<div class="activity-list">${adminActivity.map((item) => `<article class="activity-row"><span class="activity-marker" aria-hidden="true"></span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)}</p></div><time>${formatDate(item.at)}</time></article>`).join("")}</div>` : '<div class="empty-state">Activity will appear after exams are published or students begin submitting.</div>'}` : "";
  return `${heading(`Welcome, ${escapeHtml(state.user.name.split(" ")[0])}.`, state.user.role === "admin" ? "Review teacher requests, student records, and scheduled exams." : "Prepare exams and check which students are taking them.")}
    <div class="welcome-banner"><div><p class="eyebrow">${state.user.role === "admin" ? "Admin overview" : "Teacher overview"}</p><h2>${state.user.role === "admin" ? "Keep an eye on the exam schedule." : "Set up an exam for your class."}</h2><p>${state.user.role === "admin" ? "Approve teacher accounts and review the exams scheduled across courses." : "Choose a year and course, add questions, then set when the exam opens and closes."}</p></div><span class="banner-mark" aria-hidden="true">E</span></div>
    <div class="stat-grid">${stat("EXAMS", exams.length)}${extras}${stat("ACTIVE / REOPENED", available)}</div>
    ${state.user.role === "admin" && teachersPending ? `<div class="notice">${teachersPending} teacher ${teachersPending === 1 ? "request is" : "requests are"} waiting for review. <button class="text-button" type="button" data-view="approvals">Review requests →</button></div>` : ""}
    <div class="section-title"><div><h2>Recent exams</h2><p>${state.user.role === "admin" ? "All scheduled exams" : "Exams created by you"}</p></div><button class="text-button" type="button" data-view="exams">Manage exams →</button></div>${exams.length ? `<div class="exam-card"><div><h3>${escapeHtml(exams[0].title)}</h3><div class="exam-meta"><span>${escapeHtml(exams[0].year)} · ${escapeHtml(exams[0].course)}</span><span>${formatDate(exams[0].startAt)}</span><span>${exams[0].questions.length} questions</span></div></div><span class="badge ${examStatus(exams[0], null).kind}">${examStatus(exams[0], null).label}</span></div>` : '<div class="empty-state">No exams created yet. Open Exam management to publish the first one.</div>'}${adminSections}`;
}
function renderDashboard() {
  let content;
  if (state.user.role === "student") {
    content = ({ overview: studentOverview, exams: studentExams, available: studentAvailableExams, upcoming: studentUpcomingExams, history: studentHistory, profile: studentProfile, results: studentResults })[state.activeView]?.() || studentOverview();
  } else {
    content = ({ overview: staffOverview, monitoring: teacherMonitoring, leaderboard: teacherLeaderboard, reports: teacherReports, exams: examsForStaff, students: studentsPage, users: adminUsersPage, questions: adminQuestionsPage, settings: adminSettingsPage, approvals: approvalsPage })[state.activeView]?.() || staffOverview();
  }
  shell(state.message ? `<div class="message ${state.messageType === "success" ? "success" : ""}" role="status">${escapeHtml(state.message)}</div>${content}` : content);
}

function activeAttempt() {
  return state.data.attempts.find((attempt) => attempt.id === state.attemptId);
}
function currentExam() {
  const attempt = activeAttempt();
  return attempt ? state.data.exams.find((exam) => exam.id === attempt.examId) : null;
}
function renderExam() {
  const attempt = activeAttempt();
  const exam = currentExam();
  if (!attempt || !exam) { state.attemptId = null; renderDashboard(); return; }
  if (attempt.submittedAt) { renderResult(exam, attempt); return; }
  const question = exam.questions[state.questionIndex];
  const selected = attempt.answers[state.questionIndex];
  const remaining = Math.max(0, Math.ceil((new Date(attempt.expiresAt) - now()) / 1000));
  const answeredCount = Object.keys(attempt.answers || {}).length;
  app.innerHTML = `<div class="exam-shell"><header class="exam-top">${brand()}<div class="timer-box"><span>TIME REMAINING</span><strong id="exam-timer">${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}</strong></div><button class="button secondary small" type="button" data-action="submit-exam">Submit exam</button></header><main class="exam-content"><p class="eyebrow">${escapeHtml(exam.year)} · ${escapeHtml(exam.course)} · ${exam.questions.length} questions</p><h1>${escapeHtml(exam.title)}</h1><p class="exam-subtitle">Your answers are saved in this browser as you go. The exam submits when the timer ends.</p><div class="progress-line"><span style="width:${((state.questionIndex + 1) / exam.questions.length) * 100}%"></span></div><section class="exam-question"><div class="question-count">Question ${state.questionIndex + 1} of ${exam.questions.length}</div><h2>${escapeHtml(question.prompt)}</h2><div class="answer-list">${question.choices.map((choice, index) => `<label class="answer-option"><input type="radio" name="answer" value="${index}" ${Number(selected) === index ? "checked" : ""}><span><strong>${String.fromCharCode(65 + index)}.</strong> ${escapeHtml(choice)}</span></label>`).join("")}</div><div class="exam-controls"><button class="button secondary" type="button" data-action="previous-question" ${state.questionIndex === 0 ? "disabled" : ""}>← Previous</button>${state.questionIndex < exam.questions.length - 1 ? `<button class="button" type="button" data-action="next-question">Next question →</button>` : `<button class="button" type="button" data-action="submit-exam">Finish and submit</button>`}</div><div class="question-nav" aria-label="Question navigation">${exam.questions.map((_, index) => `<button type="button" class="${index === state.questionIndex ? "current" : ""} ${attempt.answers[index] !== undefined ? "answered" : ""}" data-action="go-question" data-index="${index}" aria-label="Go to question ${index + 1}">${index + 1}</button>`).join("")}</div></section></main></div>`;
  const progressLine = document.querySelector(".progress-line");
  const progressFill = progressLine?.querySelector("span");
  if (progressLine && progressFill) {
    progressLine.setAttribute("role", "progressbar");
    progressLine.setAttribute("aria-label", "Exam questions answered");
    progressLine.setAttribute("aria-valuemin", "0");
    progressLine.setAttribute("aria-valuemax", String(exam.questions.length));
    progressLine.setAttribute("aria-valuenow", String(answeredCount));
    progressFill.style.width = `${answeredCount / exam.questions.length * 100}%`;
    const progressLabel = document.createElement("p");
    progressLabel.className = "exam-progress-label";
    progressLabel.textContent = `${answeredCount} of ${exam.questions.length} questions answered`;
    progressLine.insertAdjacentElement("afterend", progressLabel);
  }
  const instructions = document.createElement("aside");
  instructions.className = "exam-instructions";
  instructions.innerHTML = "<strong>Before you begin</strong><p>Choose one answer for each question. You can move between questions before submitting. Your exam will submit automatically when the timer runs out.</p>";
  document.querySelector(".exam-question")?.before(instructions);
  const questionNavigation = document.querySelector(".question-nav");
  questionNavigation?.setAttribute("aria-label", "Question navigation. Green questions are answered; neutral questions are unanswered.");
  questionNavigation?.querySelectorAll("button").forEach((button) => {
    const questionNumber = Number(button.dataset.index) + 1;
    button.setAttribute("aria-label", `Go to question ${questionNumber}, ${button.classList.contains("answered") ? "answered" : "unanswered"}`);
  });
  if (questionNavigation) {
    const legend = document.createElement("div");
    legend.className = "question-nav-legend";
    legend.innerHTML = '<span><i class="legend-swatch answered"></i>Answered</span><span><i class="legend-swatch unanswered"></i>Not answered</span>';
    questionNavigation.before(legend);
  }
  if (remaining <= 0) submitAttempt(true);
}
function renderResult(exam, attempt) {
  const isDone = Boolean(attempt.submittedAt);
  const percent = Math.round(attempt.score / exam.questions.length * 100);
  app.innerHTML = `<main class="exam-shell"><div class="result-panel"><div class="result-mark">${isDone ? "✓" : "!"}</div><p class="eyebrow">${isDone ? "Exam submitted" : "Exam closed"}</p><h1>${isDone ? "Your work is recorded." : "Time is up."}</h1><p>${isDone ? `You completed ${escapeHtml(exam.title)} on ${formatDate(attempt.submittedAt)}.` : "Your time limit ended before this exam could be submitted."}</p>${isDone ? `<div class="score">${attempt.score} / ${exam.questions.length}<div style="font:700 11px 'Aptos','Segoe UI',sans-serif;color:var(--muted);margin-top:7px">${percent}%</div></div>` : ""}<button class="button" type="button" data-action="return-dashboard">Return to dashboard</button></div></main>`;
}
function render() {
  if (!state.user) renderAuth();
  else if (state.attemptId) renderExam();
  else renderDashboard();
}

function startLogin(form) {
  const values = new FormData(form);
  const studentId = String(values.get("studentId")).trim();
  const name = String(values.get("name")).trim();
  const year = String(values.get("year"));
  const course = String(values.get("course")).trim();
  let student = state.data.students.find((item) => item.studentId.toLowerCase() === studentId.toLowerCase());
  if (student) {
    student.name = name;
    student.year = year;
    student.course = course;
  } else {
    student = { id: `student-${crypto.randomUUID()}`, studentId, name, year, course, createdAt: new Date().toISOString() };
    state.data.students.push(student);
  }
  writeData();
  state.user = { ...student, role: "student" };
  state.activeView = "overview";
  clearMessage();
  render();
}
function staffLogin(form) {
  const values = new FormData(form);
  const role = String(values.get("staffRole"));
  const email = String(values.get("email")).trim().toLowerCase();
  const password = String(values.get("password"));
  if (role === "admin") {
    if ((email !== ADMIN_EMAIL && email !== "admin") || password !== ADMIN_PASSWORD) { showMessage("Use the admin username or email with the correct password."); render(); return; }
    state.user = { id: "admin", name: "System Admin", email: ADMIN_EMAIL, role: "admin" };
  } else {
    const teacher = state.data.teachers.find((item) => item.email.toLowerCase() === email);
    if (!teacher || teacher.password !== password) { showMessage("That teacher account was not found, or the password is incorrect."); render(); return; }
    if (!teacher.approved) { showMessage("Your teacher account is waiting for admin approval."); render(); return; }
    state.user = { id: teacher.id, name: teacher.name, email: teacher.email, role: "teacher" };
  }
  state.activeView = "overview";
  clearMessage();
  render();
}
function registerTeacher(form) {
  const values = new FormData(form);
  const email = String(values.get("email")).trim().toLowerCase();
  if (email === ADMIN_EMAIL || state.data.teachers.some((teacher) => teacher.email.toLowerCase() === email)) {
    showMessage("A staff account already uses that email address."); render(); return;
  }
  state.data.teachers.push({ id: `teacher-${crypto.randomUUID()}`, name: String(values.get("name")).trim(), email, password: String(values.get("password")), approved: false, createdAt: new Date().toISOString() });
  writeData();
  state.authMode = "login";
  state.roleChoice = "staff";
  showMessage("Request sent. An admin must approve your teacher account before you can sign in.", "success");
  render();
}
function createExam(form) {
  const values = new FormData(form);
  const questions = Array.from({ length: state.draftQuestionCount }, (_, index) => ({
    prompt: String(values.get(`prompt-${index}`)).trim(),
    choices: [0, 1, 2, 3].map((choice) => String(values.get(`choice-${index}-${choice}`)).trim()),
    correct: Number(values.get(`correct-${index}`))
  }));
  const startAt = new Date(String(values.get("startAt")));
  const endAt = new Date(String(values.get("endAt")));
  const duration = Number(values.get("duration"));
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
    showMessage("The close time must be later than the open time."); render(); return;
  }
  if (duration < 1 || duration > 300 || questions.some((question) => !question.prompt || question.choices.some((choice) => !choice))) {
    showMessage("Please complete every question and answer option, and set a time limit from 1 to 300 minutes."); render(); return;
  }
  state.data.exams.push({ id: `exam-${crypto.randomUUID()}`, title: String(values.get("title")).trim(), year: String(values.get("year")), course: String(values.get("course")).trim(), startAt: startAt.toISOString(), endAt: endAt.toISOString(), duration, allowLate: false, teacherId: state.user.id, createdAt: new Date().toISOString(), questions });
  writeData();
  state.draftQuestionCount = 1;
  showMessage("Exam published. It will appear only for students in the selected year and course.", "success");
  render();
}
function saveAdminSettings(form) {
  if (state.user?.role !== "admin") return;
  const values = new FormData(form);
  const defaultDuration = Number(values.get("defaultDuration"));
  if (defaultDuration < 1 || defaultDuration > 300) { showMessage("Choose a default exam duration from 1 to 300 minutes."); render(); return; }
  state.data.settings = { schoolName: String(values.get("schoolName")).trim(), defaultDuration };
  writeData();
  showMessage("Settings saved.", "success");
  render();
}
function openExam(examId) {
  const exam = state.data.exams.find((item) => item.id === examId);
  if (!exam || state.user.role !== "student") return;
  if (exam.year !== state.user.year || !sameCourse(exam.course, state.user.course)) { showToast("This exam is not assigned to your year and course."); return; }
  let attempt = studentAttempt(examId, state.user.id);
  if (attempt?.submittedAt) { showToast("You have already submitted this exam."); return; }
  if (!canStart(exam, attempt)) { showToast("This exam is outside its scheduled window."); return; }
  if (!attempt) {
    attempt = { id: `attempt-${crypto.randomUUID()}`, examId, studentId: state.user.id, startedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + exam.duration * 60000).toISOString(), answers: {}, submittedAt: null, score: null };
    if (!exam.allowLate && new Date(attempt.expiresAt) > new Date(exam.endAt)) attempt.expiresAt = exam.endAt;
    state.data.attempts.push(attempt);
    writeData();
  }
  state.attemptId = attempt.id;
  state.questionIndex = 0;
  render();
  runTimer();
}
function saveAnswer(value) {
  const attempt = activeAttempt();
  if (!attempt || attempt.submittedAt) return;
  attempt.answers[state.questionIndex] = Number(value);
  writeData();
  renderExam();
}
function submitAttempt(expired = false) {
  const attempt = activeAttempt();
  const exam = currentExam();
  if (!attempt || !exam || attempt.submittedAt) return;
  attempt.score = exam.questions.reduce((score, question, index) => score + (Number(attempt.answers[index]) === question.correct ? 1 : 0), 0);
  attempt.submittedAt = new Date().toISOString();
  attempt.expired = expired;
  writeData();
  renderExam();
}
let timerInterval = null;
function runTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const attempt = activeAttempt();
    if (!attempt || attempt.submittedAt) { clearInterval(timerInterval); return; }
    const remaining = Math.max(0, Math.ceil((new Date(attempt.expiresAt) - now()) / 1000));
    const display = document.querySelector("#exam-timer");
    if (display) display.textContent = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
    if (remaining <= 0) { clearInterval(timerInterval); submitAttempt(true); }
  }, 500);
}
function toggleOverride(id) {
  const exam = state.data.exams.find((item) => item.id === id);
  if (!exam || (state.user.role === "teacher" && exam.teacherId !== state.user.id)) { showToast("You do not have permission to change this exam."); return; }
  exam.allowLate = !exam.allowLate;
  writeData();
  showMessage(exam.allowLate ? `Late access reopened for ${exam.title}.` : `Late access closed for ${exam.title}.`, "success");
  render();
}
function approveTeacher(id) {
  const teacher = state.data.teachers.find((item) => item.id === id);
  if (!teacher || state.user.role !== "admin") return;
  teacher.approved = true;
  teacher.approvedAt = new Date().toISOString();
  writeData();
  showMessage(`${teacher.name} is approved and can now sign in.`, "success");
  render();
}

app.addEventListener("submit", (event) => {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  clearMessage();
  const type = form.dataset.form;
  if (type === "student-login") startLogin(form);
  if (type === "staff-login") staffLogin(form);
  if (type === "teacher-register") registerTeacher(form);
  if (type === "create-exam") createExam(form);
  if (type === "admin-settings") saveAdminSettings(form);
});
app.addEventListener("change", (event) => {
  if (event.target.matches('input[name="answer"]')) saveAnswer(event.target.value);
});
app.addEventListener("click", (event) => {
  const control = event.target.closest("button");
  if (!control) return;
  if (control.dataset.roleChoice) {
    state.roleChoice = control.dataset.roleChoice;
    state.authMode = "login";
    clearMessage();
    render();
  }
  if (control.dataset.authMode) {
    state.authMode = control.dataset.authMode;
    state.roleChoice = "staff";
    clearMessage();
    render();
  }
  if (control.dataset.view) {
    state.activeView = control.dataset.view;
    clearMessage();
    render();
  }
  if (control.dataset.action === "logout") {
    clearInterval(timerInterval);
    state.user = null;
    state.attemptId = null;
    state.activeView = "overview";
    state.roleChoice = "student";
    clearMessage();
    render();
  }
  if (control.dataset.action === "open-exam") openExam(control.dataset.id);
  if (control.dataset.action === "toggle-override") toggleOverride(control.dataset.id);
  if (control.dataset.action === "approve-teacher") approveTeacher(control.dataset.id);
  if (control.dataset.action === "download-report") downloadTeacherReport();
  if (control.dataset.action === "add-question") {
    const form = control.closest("form");
    const oldData = new FormData(form);
    const preserved = [...form.elements].filter((element) => element.name).map((element) => [element.name, element.value]);
    state.draftQuestionCount += 1;
    render();
    const newForm = document.querySelector('[data-form="create-exam"]');
    if (newForm) preserved.forEach(([name, value]) => { const field = newForm.elements.namedItem(name); if (field) field.value = value; });
    void oldData;
  }
  if (control.dataset.action === "remove-question") {
    const form = control.closest("form");
    const preserved = [...form.elements].filter((element) => element.name && !element.name.match(/^(prompt|choice|correct)-\d+/)).map((element) => [element.name, element.value]);
    const removedIndex = Number(control.dataset.index);
    const questionData = [];
    for (let index = 0; index < state.draftQuestionCount; index += 1) {
      if (index === removedIndex) continue;
      questionData.push({ prompt: form.elements.namedItem(`prompt-${index}`).value, choices: [0, 1, 2, 3].map((choice) => form.elements.namedItem(`choice-${index}-${choice}`).value), correct: form.elements.namedItem(`correct-${index}`).value });
    }
    state.draftQuestionCount = Math.max(1, state.draftQuestionCount - 1);
    render();
    const newForm = document.querySelector('[data-form="create-exam"]');
    preserved.forEach(([name, value]) => { const field = newForm.elements.namedItem(name); if (field) field.value = value; });
    questionData.forEach((question, index) => {
      newForm.elements.namedItem(`prompt-${index}`).value = question.prompt;
      question.choices.forEach((choice, choiceIndex) => { newForm.elements.namedItem(`choice-${index}-${choiceIndex}`).value = choice; });
      newForm.elements.namedItem(`correct-${index}`).value = question.correct;
    });
  }
  if (control.dataset.action === "next-question") {
    state.questionIndex = Math.min(state.questionIndex + 1, currentExam().questions.length - 1);
    renderExam();
  }
  if (control.dataset.action === "previous-question") {
    state.questionIndex = Math.max(0, state.questionIndex - 1);
    renderExam();
  }
  if (control.dataset.action === "go-question") {
    state.questionIndex = Number(control.dataset.index);
    renderExam();
  }
  if (control.dataset.action === "submit-exam") {
    const unanswered = currentExam().questions.length - Object.keys(activeAttempt().answers).length;
    const confirmation = unanswered > 0 ? `You have ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}. Submit anyway?` : "Submit your exam now? You will not be able to change your answers afterward.";
    if (!window.confirm(confirmation)) return;
    submitAttempt(false);
  }
  if (control.dataset.action === "return-dashboard") {
    clearInterval(timerInterval);
    state.attemptId = null;
    state.activeView = "overview";
    render();
  }
});

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY || !event.newValue) return;
  try {
    state.data = JSON.parse(event.newValue);
  } catch (error) {
    console.warn("Could not refresh saved exam data.", error);
    return;
  }
  if (state.user?.role === "teacher" && ["overview", "monitoring", "leaderboard", "reports"].includes(state.activeView)) renderDashboard();
});

render();
