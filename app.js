import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

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

let currentSubject = 'General Studies';
let currentActivity = 'Reading';
let currentActivityXp = 20;

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
    if(reportTab) reportTab.classList.remove('hidden');
    reportBtn.className = 'flex-1 py-3 px-5 rounded-xl transition bg-rose-400 text-white shadow-sm flex items-center justify-center gap-1.5';
    trackerBtn.className = 'flex-1 py-3 px-5 rounded-xl transition text-slate-600 hover:bg-slate-50';
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
    await loadUserData(user.uid);
  } else {
    currentUser = null;
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

async function loadUserData(uid) {
  const docRef = doc(db, 'students', uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    xp = data.xp || 0;
    logs = data.logs || [];
    isProUnlocked = data.isPro || false;
    
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
  if (activity === 'Custom Study Sprint') {
    document.getElementById('customActivityInputSection').classList.remove('hidden');
  } else {
    document.getElementById('customActivityInputSection').classList.add('hidden');
  }
}

window.updateSubject = function(val) {
    currentSubject = val.trim() !== '' ? val : 'General Studies';
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
  let activityName = currentActivity;
  if(currentActivity === 'Custom Study Sprint') {
    const customName = document.getElementById('customActivityName').value.trim();
    if(customName) activityName = `Custom: ${customName}`;
  }
  
  xp += currentActivityXp;
  updateStatsUI();
  const toast = document.getElementById('actionToast');
  document.getElementById('actionToastMsg').textContent = `✨ Sprint Completed! +${currentActivityXp} XP`;
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

// Initialize visuals on load
resetTimerDisplay();
