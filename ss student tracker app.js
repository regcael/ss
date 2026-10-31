import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, doc, getDoc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB913d4s5DkXQRwDiyTX9NTpyF-Ut1MaNk",
  authDomain: "highachievers-283f1.firebaseapp.com",
  projectId: "highachievers-283f1",
  storageBucket: "highachievers-283f1.firebasestorage.app",
  messagingSenderId: "381374978361",
  appId: "1:381374978361:web:4155c52245f00d6c44f0e8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let xp = 0;
let logs = [];
let isProUnlocked = false;

let sprintActive = false;
let isPaused = false;
let timerInterval = null;
let durationMs = 15 * 60 * 1000;
let remainingMs = durationMs;

let currentSubject = 'Company Law';
let currentActivity = 'Reading';
let currentActivityXp = 20;
let unsubscribeSnapshot = null;
let selectedSubjectFilter = 'All Papers / Subjects';
let selectedActivityFilter = 'All Activity Types';

window.switchTab = function(tab) {
  const trackerTab = document.getElementById('tabTrackerContent');
  const reportTab = document.getElementById('tabReportContent');
  const trackerBtn = document.getElementById('tabTrackerBtn');
  const reportBtn = document.getElementById('tabReportBtn');

  if (tab === 'tracker') {
    trackerTab.classList.remove('hidden');
    if(reportTab) reportTab.classList.add('hidden');
    trackerBtn.className = 'flex-1 py-3 px-5 rounded-xl transition bg-rose-400 text-white shadow-sm';
    reportBtn.className = 'flex-1 py-3 px-5 rounded-xl transition text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5';
  } else {
    trackerTab.classList.add('hidden');
    if(reportTab) {
      reportTab.classList.remove('hidden');
      renderReportView();
    }
    reportBtn.className = 'flex-1 py-3 px-5 rounded-xl transition bg-rose-400 text-white shadow-sm flex items-center justify-center gap-1.5';
    trackerBtn.className = 'flex-1 py-3 px-5 rounded-xl transition text-slate-600 hover:bg-slate-50';
  }
}

window.updateLiveBadge = function() {
  const subjectInput = document.getElementById('customSubjectInput');
  const activeSub = subjectInput && subjectInput.value.trim() !== '' ? subjectInput.value.trim() : currentSubject;
  
  let actDisplay = currentActivity;
  if(currentActivity === 'Custom Study Sprint') {
    const customName = document.getElementById('customActivityName');
    const customVal = customName && customName.value.trim() !== '' ? customName.value.trim() : 'Custom Sprint';
    actDisplay = `Custom: ${customVal}`;
  }

  const badgeSub = document.getElementById('badgeSubjectText');
  const badgeAct = document.getElementById('badgeActivityText');
  
  if(badgeSub) badgeSub.textContent = activeSub;
  if(badgeAct) badgeAct.textContent = actDisplay;
}

window.renderReportView = function() {
  const reportTab = document.getElementById('tabReportContent');
  if (!reportTab) return;

  if (isProUnlocked) {
    // Calculate total hours invested from actual accumulated minutes across all logs
    const totalMinutes = logs.reduce((acc, l) => acc + (l.durationMins || 15), 0);
    const totalHours = (totalMinutes / 60).toFixed(1);
    
    // Extract unique subjects & activities dynamically from logs
    const uniqueSubjects = Array.from(new Set(logs.map(l => l.subject))).filter(Boolean);
    const subjectInput = document.getElementById('customSubjectInput');
    const currentTypedSub = subjectInput && subjectInput.value.trim() !== '' ? subjectInput.value.trim() : currentSubject;
    if (currentTypedSub && !uniqueSubjects.includes(currentTypedSub)) {
      uniqueSubjects.push(currentTypedSub);
    }

    const uniqueActivities = Array.from(new Set(logs.map(l => l.activity))).filter(Boolean);
    ['Reading', 'Lecture', 'Problem Solving', 'Note-Making', 'Revision', 'Custom Study Sprint'].forEach(act => {
      if (!uniqueActivities.includes(act)) uniqueActivities.push(act);
    });

    // Filter logs based on selected filters
    const filteredLogs = logs.filter(l => {
      const matchSub = selectedSubjectFilter === 'All Papers / Subjects' || l.subject === selectedSubjectFilter;
      const matchAct = selectedActivityFilter === 'All Activity Types' || l.activity === selectedActivityFilter;
      return matchSub && matchAct;
    });

    reportTab.innerHTML = `
      <div class="bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-rose-100 space-y-6">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div class="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-slate-500">
            <span>📊</span> PROGRESS & TRENDS ANALYTICS
          </div>
          <div class="flex gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
            <button class="px-3 py-1.5 rounded-lg bg-white shadow-sm text-rose-500">This Week</button>
            <button class="px-3 py-1.5 rounded-lg hover:bg-white/50 transition">This Month</button>
            <button class="px-3 py-1.5 rounded-lg hover:bg-white/50 transition">Custom Range</button>
          </div>
        </div>

        <!-- Dynamic Filters -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Filter by Subject Paper</label>
            <select id="filterSubjectSelect" onchange="window.setSubjectFilter(this.value)" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none">
              <option value="All Papers / Subjects" ${selectedSubjectFilter === 'All Papers / Subjects' ? 'selected' : ''}>All Papers / Subjects</option>
              ${uniqueSubjects.map(sub => `<option value="${sub}" ${selectedSubjectFilter === sub ? 'selected' : ''}>${sub}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-400 uppercase mb-1">Filter by Activity Key</label>
            <select id="filterActivitySelect" onchange="window.setActivityFilter(this.value)" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none">
              <option value="All Activity Types" ${selectedActivityFilter === 'All Activity Types' ? 'selected' : ''}>All Activity Types</option>
              ${uniqueActivities.map(act => `<option value="${act}" ${selectedActivityFilter === act ? 'selected' : ''}>${act}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Stats Grid -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          <div class="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 text-center">
            <p class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Total XP Earned</p>
            <p class="text-2xl font-black text-rose-500 mt-1">${xp} XP</p>
          </div>
          <div class="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 text-center">
            <p class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Study Sprints</p>
            <p class="text-2xl font-black text-slate-700 mt-1">${logs.length}</p>
          </div>
          <div class="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 text-center">
            <p class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Hours Invested</p>
            <p class="text-2xl font-black text-indigo-600 mt-1">${totalHours}h</p>
          </div>
          <div class="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 text-center">
            <p class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Habits Logged</p>
            <p class="text-2xl font-black text-emerald-600 mt-1">3</p>
          </div>
        </div>

        <!-- Subject Breakdown -->
        <div class="space-y-3 pt-2">
          <h4 class="text-xs font-extrabold uppercase tracking-widest text-slate-500">📈 Subject Breakdown & Trends</h4>
          <div class="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
            ${uniqueSubjects.length > 0 ? uniqueSubjects.map(sub => {
              const subXp = logs.filter(l => l.subject === sub).reduce((acc, l) => acc + l.xp, 0);
              return `
                <div>
                  <div class="flex justify-between text-xs font-bold text-slate-700 mb-1">
                    <span>${sub}</span>
                    <span>${subXp} XP</span>
                  </div>
                  <div class="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div class="bg-rose-400 h-full rounded-full" style="width: ${Math.min(Math.max((subXp / Math.max(xp, 1)) * 100, 10), 100)}%"></div>
                  </div>
                </div>
              `;
            }).join('') : `
              <p class="text-xs text-slate-400 italic">No subject data yet.</p>
            `}
          </div>
        </div>

        <!-- Activity Log History -->
        <div class="space-y-3 pt-2">
          <div class="flex justify-between items-center">
            <h4 class="text-xs font-extrabold uppercase tracking-widest text-slate-500">🗂️ Activity Log History</h4>
            <button onclick="window.clearLogs()" class="text-xs text-rose-500 font-bold hover:underline">Clear History</button>
          </div>
          <div class="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-100 text-slate-400 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th class="p-3.5">Date / Time</th>
                  <th class="p-3.5">Subject / Paper</th>
                  <th class="p-3.5">Activity</th>
                  <th class="p-3.5 text-right">XP</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 font-medium text-slate-700">
                ${filteredLogs.length > 0 ? filteredLogs.map(l => `
                  <tr>
                    <td class="p-3.5 text-slate-500">${l.date}</td>
                    <td class="p-3.5 font-bold">${l.subject}</td>
                    <td class="p-3.5"><span class="bg-rose-50 text-rose-600 px-2.5 py-1 rounded-full font-bold">${l.activity} (${l.durationMins || 15}m)</span></td>
                    <td class="p-3.5 text-right font-black text-rose-500">+${l.xp} XP</td>
                  </tr>
                `).join('') : `
                  <tr>
                    <td colspan="4" class="p-6 text-center text-slate-400 italic font-medium">No study sprints matching filter criteria.</td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;
  }
}

window.setSubjectFilter = function(val) {
  selectedSubjectFilter = val;
  renderReportView();
}

window.setActivityFilter = function(val) {
  selectedActivityFilter = val;
  renderReportView();
}

window.clearLogs = function() {
  if (confirm("Clear all logs?")) {
    logs = [];
    xp = 0;
    updateStatsUI();
    renderReportView();
  }
}

window.copyUpiId = function() {
  const upiText = document.getElementById('upiIdText').textContent;
  navigator.clipboard.writeText(upiText).then(() => {
    const toast = document.getElementById('actionToast');
    document.getElementById('actionToastMsg').textContent = `✨ UPI ID Copied!`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3200);
  });
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('logoutBtn').textContent = user.email ? user.email.split('@')[0] : 'Account';
    loadUserDataRealtime(user.uid);
  } else {
    currentUser = null;
    if (unsubscribeSnapshot) unsubscribeSnapshot();
    document.getElementById('authScreen').classList.remove('hidden');
  }
});

function handleAuthError() {
  const errBox = document.getElementById('authErrorMsg');
  const agreeCheckbox = document.getElementById('agreeTosCheckbox');
  
  if (!agreeCheckbox.checked) {
    errBox.textContent = "Please agree to the Terms of Service to continue.";
    errBox.classList.remove('hidden');
    
    const tosContainer = document.getElementById('tosCheckboxContainer');
    tosContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    tosContainer.classList.remove('animate-gentle-attention');
    void tosContainer.offsetWidth;
    tosContainer.classList.add('animate-gentle-attention');
    return true;
  }
  return false;
}

document.getElementById('agreeTosCheckbox').addEventListener('change', function() {
  if (this.checked) {
    document.getElementById('tosCheckboxContainer').classList.remove('animate-gentle-attention');
  }
});

if(document.getElementById('googleSignInBtn')) {
  document.getElementById('googleSignInBtn').onclick = async () => {
    if (handleAuthError()) return;
    try { await signInWithPopup(auth, new GoogleAuthProvider()); } 
    catch (err) { document.getElementById('authErrorMsg').textContent = err.message; document.getElementById('authErrorMsg').classList.remove('hidden'); }
  };
}

if(document.getElementById('emailSignUpBtn')) {
  document.getElementById('emailSignUpBtn').onclick = async () => {
    if (handleAuthError()) return;
    const email = document.getElementById('authEmail').value.trim();
    const pwd = document.getElementById('authPassword').value;
    try { await createUserWithEmailAndPassword(auth, email, pwd); }
    catch(err) { document.getElementById('authErrorMsg').textContent = err.message; document.getElementById('authErrorMsg').classList.remove('hidden'); }
  };
}

if(document.getElementById('emailLogInBtn')) {
  document.getElementById('emailLogInBtn').onclick = async () => {
    const email = document.getElementById('authEmail').value.trim();
    const pwd = document.getElementById('authPassword').value;
    try { await signInWithEmailAndPassword(auth, email, pwd); }
    catch(err) { document.getElementById('authErrorMsg').textContent = err.message; document.getElementById('authErrorMsg').classList.remove('hidden'); }
  };
}

if(document.getElementById('forgotPasswordBtn')) {
  document.getElementById('forgotPasswordBtn').onclick = async () => {
    const email = document.getElementById('authEmail').value.trim();
    const errBox = document.getElementById('authErrorMsg');
    if(!email) {
      errBox.textContent = "Please enter your email address to reset password.";
      errBox.classList.remove('hidden');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      errBox.textContent = "Reset email sent!";
      errBox.className = "text-xs text-emerald-600 font-bold";
      errBox.classList.remove('hidden');
    } catch(err) {
      errBox.textContent = err.message;
      errBox.className = "text-xs text-rose-500 font-bold";
      errBox.classList.remove('hidden');
    }
  };
}

if(document.getElementById('logoutBtn')) {
  document.getElementById('logoutBtn').onclick = async () => {
    if(confirm('Log out?')) await signOut(auth);
  };
}

function loadUserDataRealtime(uid) {
  const docRef = doc(db, 'students', uid);
  
  unsubscribeSnapshot = onSnapshot(docRef, async (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      xp = data.xp || 0;
      logs = data.logs || [];
      isProUnlocked = data.isPro || false;
      
      if (isProUnlocked) {
        const reportBtn = document.getElementById('tabReportBtn');
        if (reportBtn) {
          reportBtn.innerHTML = `<span>📊 Pro Analytics Unlocked ✨</span>`;
          reportBtn.className = 'flex-1 py-3 px-5 rounded-xl transition bg-emerald-500 text-white shadow-sm flex items-center justify-center gap-1.5 font-extrabold';
        }
      }
      
      if (!data.email && currentUser.email) {
        await setDoc(docRef, { email: currentUser.email }, { merge: true });
      }
    } else {
      const defaultData = { xp: 0, logs: [], isPro: false };
      if (currentUser.email) {
        defaultData.email = currentUser.email;
      }
      await setDoc(docRef, defaultData);
    }
    updateStatsUI();
    renderReportView();
  });
}

async function saveUserData() {
  if (!currentUser) return;
  const docRef = doc(db, 'students', currentUser.uid);
  const dataToSave = { xp, logs };
  if (currentUser.email) {
      dataToSave.email = currentUser.email;
  }
  await setDoc(docRef, dataToSave, { merge: true }); 
}

function updateStatsUI() {
  const xpBadge = document.getElementById('stickyXpText');
  if(xpBadge) xpBadge.textContent = `${xp} XP`;
  saveUserData();
}

window.selectActivity = function(activity, xpValue) {
  currentActivity = activity;
  currentActivityXp = xpValue;
  
  document.querySelectorAll('.act-btn').forEach(btn => {
    btn.classList.remove('border-2', 'border-emerald-300', 'shadow-sm');
    btn.classList.add('border', 'border-slate-200');
  });
  const activeBtn = document.getElementById(`act-${activity}`);
  if (activeBtn) {
    activeBtn.classList.remove('border', 'border-slate-200');
    activeBtn.classList.add('border-2', 'border-emerald-300', 'shadow-sm');
  }

  if (activity === 'Custom Study Sprint') {
    document.getElementById('customActivityInputSection').classList.remove('hidden');
  } else {
    document.getElementById('customActivityInputSection').classList.add('hidden');
  }
  window.updateLiveBadge();
}

window.updateSubject = function(val) {
    currentSubject = val.trim() !== '' ? val : 'Company Law';
    window.updateLiveBadge();
}

window.logHabitXP = function(habitName, amount, msg) {
    xp += amount;
    updateStatsUI();
    const toast = document.getElementById('actionToast');
    document.getElementById('actionToastMsg').textContent = `✨ ${msg}! +${amount} XP`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3200);
}

document.getElementById('timerDurationSelect').addEventListener('change', (e) => {
  if(e.target.value === 'custom') {
    const customMins = prompt("Enter custom minutes:");
    if(customMins && !isNaN(customMins)) {
      durationMs = customMins * 60 * 1000;
    } else {
      e.target.value = "15";
      durationMs = 15 * 60 * 1000;
    }
  } else {
    durationMs = parseInt(e.target.value) * 60 * 1000;
  }
  if(!sprintActive) resetTimerDisplay();
});

function resetTimerDisplay() {
  remainingMs = durationMs;
  updateTimerUI();
  updateHourglassVisuals(0);
}

function updateTimerUI() {
  const mins = Math.floor(remainingMs / 60000);
  const secs = Math.floor((remainingMs % 60000) / 1000);
  document.getElementById('hourglassTimerText').textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateHourglassVisuals(elapsed) {
  const progress = Math.min(Math.max(elapsed / durationMs, 0), 1);
  
  const topY = 14 + (31 * progress);
  const topHW = 22 * (1 - progress);
  const topPoints = `${50 - topHW},${topY} ${50 + topHW},${topY} 50,45`;
  
  const botY = 86 - (31 * progress);
  const botHW = 22 * (1 - progress);
  const botPoints = `28,86 72,86 ${50 + botHW},${botY} ${50 - botHW},${botY}`;

  const topPoly = document.getElementById('topSandPoly');
  if (topPoly) topPoly.setAttribute('points', topPoints);

  const botPoly = document.getElementById('bottomSandPoly');
  if (botPoly) botPoly.setAttribute('points', botPoints);

  const stream = document.getElementById('sandStream');
  if (stream) {
    stream.style.opacity = (progress > 0 && progress < 1 && !isPaused) ? '1' : '0';
  }
}

document.getElementById('startSprintBtn').onclick = () => {
  sprintActive = true;
  isPaused = false;
  document.getElementById('startSprintBtn').classList.add('hidden');
  document.getElementById('pauseSprintBtn').classList.remove('hidden');
  document.getElementById('stopSprintBtn').classList.remove('hidden');
  document.getElementById('hourglassStatusText').textContent = 'Sand Flowing...';
  
  const icon = document.getElementById('hourglassIcon');
  if(icon) {
    icon.classList.add('animate-flip');
    setTimeout(() => icon.classList.remove('animate-flip'), 800);
  }

  timerInterval = setInterval(() => {
    if (!isPaused) {
      remainingMs -= 1000;
      updateTimerUI();
      updateHourglassVisuals(durationMs - remainingMs);
      if (remainingMs <= 0) completeSprint();
    }
  }, 1000);
};

document.getElementById('pauseSprintBtn').onclick = () => {
  isPaused = true;
  document.getElementById('pauseSprintBtn').classList.add('hidden');
  document.getElementById('resumeSprintBtn').classList.remove('hidden');
  document.getElementById('hourglassStatusText').textContent = 'Paused';
  const stream = document.getElementById('sandStream');
  if (stream) stream.style.opacity = '0';
};

document.getElementById('resumeSprintBtn').onclick = () => {
  isPaused = false;
  document.getElementById('resumeSprintBtn').classList.add('hidden');
  document.getElementById('pauseSprintBtn').classList.remove('hidden');
  document.getElementById('hourglassStatusText').textContent = 'Sand Flowing...';
  const stream = document.getElementById('sandStream');
  if (stream) stream.style.opacity = '1';
};

document.getElementById('stopSprintBtn').onclick = () => {
  clearInterval(timerInterval);
  sprintActive = false;
  isPaused = false;
  resetTimerDisplay();
  
  document.getElementById('startSprintBtn').classList.remove('hidden');
  document.getElementById('pauseSprintBtn').classList.add('hidden');
  document.getElementById('resumeSprintBtn').classList.add('hidden');
  document.getElementById('stopSprintBtn').classList.add('hidden');
  document.getElementById('hourglassStatusText').textContent = 'Ready to Flow';
};

function completeSprint() {
  clearInterval(timerInterval);
  
  const subjectInput = document.getElementById('customSubjectInput');
  const activeSubject = subjectInput && subjectInput.value.trim() !== '' ? subjectInput.value.trim() : currentSubject;

  let activityName = currentActivity;
  if(currentActivity === 'Custom Study Sprint') {
    const customName = document.getElementById('customActivityName');
    const customVal = customName && customName.value.trim() !== '' ? customName.value.trim() : 'Custom Sprint';
    activityName = `Custom: ${customVal}`;
  }

  const sessionMinutes = Math.round(durationMs / 60000);
  const now = new Date();
  const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  // Check if the most recent log entry matches the current subject & activity (auto-chained sprint)
  if (logs.length > 0 && logs[0].subject === activeSubject && logs[0].activity === activityName) {
    logs[0].durationMins = (logs[0].durationMins || 15) + sessionMinutes;
    logs[0].xp += currentActivityXp;
  } else {
    logs.unshift({
      date: dateStr,
      subject: activeSubject,
      activity: activityName,
      durationMins: sessionMinutes,
      xp: currentActivityXp
    });
  }
  
  xp += currentActivityXp;
  updateStatsUI();
  renderReportView();
  
  const toast = document.getElementById('actionToast');
  document.getElementById('actionToastMsg').textContent = `✨ Sprint Completed! +${currentActivityXp} XP (${sessionMinutes}m logged)`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3200);
  
  const icon = document.getElementById('hourglassIcon');
  if(icon) {
    icon.classList.add('animate-flip');
    setTimeout(() => icon.classList.remove('animate-flip'), 800);
  }
  resetTimerDisplay();
  document.getElementById('startSprintBtn').onclick(); 
}

resetTimerDisplay();
window.updateLiveBadge();
