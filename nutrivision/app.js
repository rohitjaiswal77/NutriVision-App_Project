// ============ NutriVision — working app logic ============

const LS_KEYS = { entries: 'nv_entries', plans: 'nv_plans', goal: 'nv_goal' };

const DEFAULT_GOAL = { calories: 2200, protein: 120, carbs: 250, fat: 70 };

// A tiny local "food knowledge" table used to give a realistic starting
// estimate after a scan/upload. This app does not call any external AI
// service — it offers an editable quick-estimate, which the user confirms
// or corrects before it's saved to their journal.
const QUICK_FOODS = [
  { name: 'Avocado Sourdough Toast', meal: 'breakfast', calories: 340, protein: 12, carbs: 34, fat: 18, icon: 'bakery_dining' },
  { name: 'Poached Eggs & Black Coffee', meal: 'breakfast', calories: 310, protein: 22, carbs: 4, fat: 20, icon: 'egg_alt' },
  { name: 'Garden Harvest Salad', meal: 'lunch', calories: 420, protein: 15, carbs: 45, fat: 22, icon: 'nutrition' },
  { name: 'Grilled Salmon Salad', meal: 'lunch', calories: 540, protein: 38, carbs: 18, fat: 30, icon: 'set_meal' },
  { name: 'Tomato & Feta Bowl', meal: 'lunch', calories: 380, protein: 14, carbs: 30, fat: 22, icon: 'ramen_dining' },
  { name: 'Atlantic Salmon Grill', meal: 'dinner', calories: 580, protein: 42, carbs: 12, fat: 35, icon: 'dinner_dining' },
  { name: 'Roast Chicken & Veg', meal: 'dinner', calories: 510, protein: 40, carbs: 28, fat: 22, icon: 'kebab_dining' },
  { name: 'Mixed Nuts Handful', meal: 'snack', calories: 180, protein: 6, carbs: 7, fat: 15, icon: 'cookie' },
  { name: 'Greek Yogurt & Berries', meal: 'snack', calories: 160, protein: 12, carbs: 20, fat: 3, icon: 'icecream' },
];

// ---------- Persistence ----------
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

let state = {
  entries: load(LS_KEYS.entries, []),
  plans: load(LS_KEYS.plans, []),
  goal: load(LS_KEYS.goal, DEFAULT_GOAL),
  route: 'home',
};

function persistEntries() { save(LS_KEYS.entries, state.entries); }
function persistPlans() { save(LS_KEYS.plans, state.plans); }
function persistGoal() { save(LS_KEYS.goal, state.goal); }

// ---------- Helpers ----------
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function fmtDate(d) {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString(undefined, { weekday: undefined, year: 'numeric', month: 'long', day: 'numeric' });
}
function fmtTime(d) {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
function todaysEntries() { return state.entries.filter(e => e.date === todayStr()); }
function sumField(list, field) { return list.reduce((s, e) => s + (Number(e[field]) || 0), 0); }
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.style.opacity = '0'; }, 2200);
}

// ---------- Router ----------
const routes = ['home', 'scan', 'upload', 'journal', 'planning'];

function navigate(route) {
  if (!routes.includes(route)) route = 'home';
  state.route = route;
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.route === route);
  });
  stopCameraIfRunning();
  render();
  document.getElementById('app').scrollTo?.(0, 0);
  window.scrollTo(0, 0);
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => navigate(btn.dataset.route));
});

document.getElementById('goal-btn').addEventListener('click', openGoalModal);

// ---------- Modal helper ----------
function openModal(innerHTML, onMount) {
  const tpl = document.getElementById('tpl-modal').content.cloneNode(true);
  const backdrop = tpl.querySelector('.modal-backdrop');
  const box = tpl.querySelector('.modal-box');
  box.innerHTML = innerHTML;
  document.body.appendChild(backdrop);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
  if (onMount) onMount(box);
  document.body.style.overflow = 'hidden';
  return box;
}
function closeModal() {
  document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
  document.body.style.overflow = '';
}

// ---------- Goal modal ----------
function openGoalModal() {
  const g = state.goal;
  const html = `
    <h3 class="font-headline-md text-xl text-primary mb-4">Daily Targets</h3>
    <div class="dotted-rule"></div>
    <div class="space-y-3 mt-2">
      <label class="block">
        <span class="font-label-caps text-[10px] text-on-surface-variant">CALORIES (KCAL)</span>
        <input id="g-cal" type="number" class="ledger-input font-typewriter mt-1" value="${g.calories}"/>
      </label>
      <label class="block">
        <span class="font-label-caps text-[10px] text-on-surface-variant">PROTEIN (g)</span>
        <input id="g-pro" type="number" class="ledger-input font-typewriter mt-1" value="${g.protein}"/>
      </label>
      <label class="block">
        <span class="font-label-caps text-[10px] text-on-surface-variant">CARBS (g)</span>
        <input id="g-carb" type="number" class="ledger-input font-typewriter mt-1" value="${g.carbs}"/>
      </label>
      <label class="block">
        <span class="font-label-caps text-[10px] text-on-surface-variant">FAT (g)</span>
        <input id="g-fat" type="number" class="ledger-input font-typewriter mt-1" value="${g.fat}"/>
      </label>
    </div>
    <div class="flex gap-3 mt-6">
      <button id="g-cancel" class="pressable-outline flex-1 py-3 rounded-lg font-label-caps">CANCEL</button>
      <button id="g-save" class="pressable-button flex-1 py-3 rounded-lg font-label-caps">SAVE</button>
    </div>
  `;
  const box = openModal(html);
  box.querySelector('#g-cancel').onclick = closeModal;
  box.querySelector('#g-save').onclick = () => {
    state.goal = {
      calories: Number(box.querySelector('#g-cal').value) || DEFAULT_GOAL.calories,
      protein: Number(box.querySelector('#g-pro').value) || DEFAULT_GOAL.protein,
      carbs: Number(box.querySelector('#g-carb').value) || DEFAULT_GOAL.carbs,
      fat: Number(box.querySelector('#g-fat').value) || DEFAULT_GOAL.fat,
    };
    persistGoal();
    closeModal();
    toast('Targets updated');
    render();
  };
}

// ---------- Entry form modal (used by Scan + Upload) ----------
function openEntryForm(photoDataUrl, prefill) {
  const suggestion = prefill || QUICK_FOODS[Math.floor(Math.random() * QUICK_FOODS.length)];
  const html = `
    <h3 class="font-headline-md text-xl text-primary mb-2">Log This Meal</h3>
    <p class="font-label-caps text-[10px] text-on-surface-variant mb-3">QUICK ESTIMATE — EDIT ANYTHING BEFORE SAVING</p>
    ${photoDataUrl ? `<img src="${photoDataUrl}" class="w-full h-40 object-cover rounded-lg border border-outline mb-4"/>` : ''}
    <div class="dotted-rule"></div>
    <div class="space-y-3 mt-2">
      <label class="block">
        <span class="font-label-caps text-[10px] text-on-surface-variant">DISH NAME</span>
        <input id="e-name" class="ledger-input mt-1" value="${suggestion.name}"/>
      </label>
      <label class="block">
        <span class="font-label-caps text-[10px] text-on-surface-variant">MEAL</span>
        <select id="e-meal" class="ledger-input mt-1">
          ${['breakfast','lunch','dinner','snack'].map(m => `<option value="${m}" ${m===suggestion.meal?'selected':''}>${m[0].toUpperCase()+m.slice(1)}</option>`).join('')}
        </select>
      </label>
      <div class="grid grid-cols-2 gap-3">
        <label class="block">
          <span class="font-label-caps text-[10px] text-on-surface-variant">CALORIES</span>
          <input id="e-cal" type="number" class="ledger-input font-typewriter mt-1" value="${suggestion.calories}"/>
        </label>
        <label class="block">
          <span class="font-label-caps text-[10px] text-on-surface-variant">PROTEIN (g)</span>
          <input id="e-pro" type="number" class="ledger-input font-typewriter mt-1" value="${suggestion.protein}"/>
        </label>
        <label class="block">
          <span class="font-label-caps text-[10px] text-on-surface-variant">CARBS (g)</span>
          <input id="e-carb" type="number" class="ledger-input font-typewriter mt-1" value="${suggestion.carbs}"/>
        </label>
        <label class="block">
          <span class="font-label-caps text-[10px] text-on-surface-variant">FAT (g)</span>
          <input id="e-fat" type="number" class="ledger-input font-typewriter mt-1" value="${suggestion.fat}"/>
        </label>
      </div>
      <label class="block">
        <span class="font-label-caps text-[10px] text-on-surface-variant">NOTE (OPTIONAL)</span>
        <textarea id="e-note" class="ledger-input mt-1" rows="2" placeholder="How did it taste?"></textarea>
      </label>
    </div>
    <div class="flex gap-3 mt-6">
      <button id="e-cancel" class="pressable-outline flex-1 py-3 rounded-lg font-label-caps">DISCARD</button>
      <button id="e-save" class="pressable-button flex-1 py-3 rounded-lg font-label-caps">ADD TO JOURNAL</button>
    </div>
  `;
  const box = openModal(html);
  box.querySelector('#e-cancel').onclick = closeModal;
  box.querySelector('#e-save').onclick = () => {
    const name = box.querySelector('#e-name').value.trim() || 'Untitled Meal';
    const entry = {
      id: uid(),
      date: todayStr(),
      timeISO: new Date().toISOString(),
      name,
      meal: box.querySelector('#e-meal').value,
      calories: Number(box.querySelector('#e-cal').value) || 0,
      protein: Number(box.querySelector('#e-pro').value) || 0,
      carbs: Number(box.querySelector('#e-carb').value) || 0,
      fat: Number(box.querySelector('#e-fat').value) || 0,
      note: box.querySelector('#e-note').value.trim(),
      photo: photoDataUrl || null,
    };
    state.entries.unshift(entry);
    persistEntries();
    closeModal();
    toast('Added to journal ✓');
    navigate('journal');
  };
}

// ---------- Camera handling (Scan screen) ----------
let mediaStream = null;
function stopCameraIfRunning() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
}
async function startCamera(videoEl, statusEl) {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    videoEl.srcObject = mediaStream;
    await videoEl.play();
    if (statusEl) statusEl.textContent = '';
  } catch (err) {
    if (statusEl) statusEl.innerHTML = `Camera unavailable (${err.name}). Use "Gallery" to pick a photo instead.`;
  }
}

// ---------- Progress ring SVG ----------
function ring(pct, radius, stroke, colorClass) {
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(Math.max(pct, 0), 1));
  return `<circle class="${colorClass} progress-ring-circle" cx="${radius+stroke}" cy="${radius+stroke}" fill="transparent" r="${radius}" stroke="currentColor" stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" stroke-linecap="round" stroke-width="${stroke}"></circle>`;
}
function ringBg(radius, stroke) {
  return `<circle class="text-surface-variant" cx="${radius+stroke}" cy="${radius+stroke}" fill="transparent" r="${radius}" stroke="currentColor" stroke-width="${stroke}"></circle>`;
}

// ================= SCREENS =================

function screenHome() {
  const todays = todaysEntries();
  const totalCal = sumField(todays, 'calories');
  const totalPro = sumField(todays, 'protein');
  const totalCarb = sumField(todays, 'carbs');
  const totalFat = sumField(todays, 'fat');
  const g = state.goal;
  const calPct = g.calories ? totalCal / g.calories : 0;
  const proPct = g.protein ? totalPro / g.protein : 0;
  const fatPct = g.fat ? totalFat / g.fat : 0;

  const byMeal = m => sumField(todays.filter(e => e.meal === m), 'calories');
  const recent = todays.slice(0, 4);

  return `
  <div class="grid grid-cols-1 md:grid-cols-12 gap-gutter">
    <div class="md:col-span-6 retro-card p-card-padding rounded-xl flex flex-col items-center">
      <div class="w-full flex justify-between items-center mb-2">
        <span class="font-label-caps text-label-caps text-on-surface-variant">TODAY'S LEDGER</span>
        <span class="material-symbols-outlined text-primary">restaurant</span>
      </div>
      <div class="relative w-48 h-48 flex items-center justify-center mb-2">
        <svg class="w-full h-full" viewBox="0 0 192 192">${ringBg(80,12)}${ring(calPct,80,12,'text-primary-container')}</svg>
        <div class="absolute flex flex-col items-center">
          <span class="font-display-lg text-3xl text-primary">${totalCal}</span>
          <span class="font-label-caps text-[10px] text-on-surface-variant">OF ${g.calories} KCAL</span>
        </div>
      </div>
      <div class="dotted-rule"></div>
      <div class="w-full grid grid-cols-3 gap-2 mt-2">
        <div class="text-center"><p class="font-label-caps text-[10px] text-on-surface-variant">BREAKFAST</p><p class="font-typewriter font-bold">${byMeal('breakfast')}</p></div>
        <div class="text-center border-x border-outline-variant"><p class="font-label-caps text-[10px] text-on-surface-variant">LUNCH</p><p class="font-typewriter font-bold">${byMeal('lunch')}</p></div>
        <div class="text-center"><p class="font-label-caps text-[10px] text-on-surface-variant">DINNER+SNACK</p><p class="font-typewriter font-bold">${byMeal('dinner')+byMeal('snack')}</p></div>
      </div>
    </div>

    <div class="md:col-span-6 grid grid-cols-2 gap-gutter">
      <div class="retro-card p-card-padding rounded-xl flex flex-col items-center text-center">
        <span class="font-label-caps text-label-caps text-on-surface-variant mb-4">PROTEIN</span>
        <div class="relative w-24 h-24 mb-2">
          <svg class="w-full h-full" viewBox="0 0 96 96">${ringBg(40,8)}${ring(proPct,40,8,'text-secondary')}</svg>
          <span class="absolute inset-0 flex items-center justify-center font-typewriter text-lg">${totalPro}g</span>
        </div>
        <p class="font-label-caps text-[10px] text-secondary">${Math.round(proPct*100)}% OF TARGET</p>
      </div>
      <div class="retro-card p-card-padding rounded-xl flex flex-col items-center text-center">
        <span class="font-label-caps text-label-caps text-on-surface-variant mb-4">FATS</span>
        <div class="relative w-24 h-24 mb-2">
          <svg class="w-full h-full" viewBox="0 0 96 96">${ringBg(40,8)}${ring(fatPct,40,8,'text-tertiary-container')}</svg>
          <span class="absolute inset-0 flex items-center justify-center font-typewriter text-lg">${totalFat}g</span>
        </div>
        <p class="font-label-caps text-[10px] text-tertiary">${Math.round(fatPct*100)}% OF TARGET</p>
      </div>
      <div class="col-span-2 retro-card p-card-padding rounded-xl flex items-center justify-between">
        <div>
          <p class="font-label-caps text-[10px] text-primary">CARBS TODAY</p>
          <p class="font-headline-md text-lg">${totalCarb}g <span class="text-on-surface-variant text-xs font-body-main">/ ${g.carbs}g</span></p>
        </div>
        <span class="material-symbols-outlined text-secondary text-3xl">grain</span>
      </div>
    </div>

    <div class="md:col-span-12 mt-2">
      <button id="home-scan-btn" class="w-full pressable-button py-4 rounded-xl flex items-center justify-center gap-3">
        <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">photo_camera</span>
        <span class="font-label-caps text-lg tracking-widest">START VISION SCAN</span>
      </button>
    </div>

    <div class="md:col-span-12 mt-6">
      <h3 class="font-headline-md text-xl text-primary mb-4 border-b-2 border-primary-container/20 pb-2">Today's Journal</h3>
      <div class="space-y-4">
        ${recent.length === 0 ? `<p class="font-body-main text-on-surface-variant italic text-center py-6">Nothing logged yet today. Scan or upload a meal to begin.</p>` : recent.map(e => entryRow(e)).join('')}
      </div>
    </div>
  </div>`;
}

function entryRow(e) {
  const iconMap = { breakfast: 'egg_alt', lunch: 'lunch_dining', dinner: 'dinner_dining', snack: 'cookie' };
  return `
  <div class="retro-card p-4 rounded-lg flex justify-between items-center bg-white/50">
    <div class="flex gap-4 items-center overflow-hidden">
      ${e.photo ? `<img src="${e.photo}" class="w-12 h-12 rounded object-cover border border-outline-variant flex-shrink-0"/>` :
        `<div class="w-12 h-12 rounded bg-surface-container-low flex items-center justify-center border border-outline-variant flex-shrink-0"><span class="material-symbols-outlined text-secondary">${iconMap[e.meal]||'restaurant'}</span></div>`}
      <div class="min-w-0">
        <p class="font-body-main font-bold truncate">${escapeHtml(e.name)}</p>
        <p class="font-label-caps text-[10px] text-on-surface-variant">${fmtTime(new Date(e.timeISO))} • ${e.calories} KCAL</p>
      </div>
    </div>
    <button class="del-entry material-symbols-outlined text-outline flex-shrink-0" data-id="${e.id}" title="Delete">delete</button>
  </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function mountHome() {
  document.getElementById('home-scan-btn').onclick = () => navigate('scan');
  document.querySelectorAll('.del-entry').forEach(btn => btn.onclick = () => {
    state.entries = state.entries.filter(e => e.id !== btn.dataset.id);
    persistEntries();
    render();
    toast('Entry removed');
  });
}

// ----- Scan screen -----
function screenScan() {
  return `
  <div class="flex flex-col items-center">
    <div class="viewfinder-frame w-full max-w-md aspect-[3/4] relative">
      <video id="cam-video" class="absolute inset-0 w-full h-full object-cover" muted playsinline></video>
      <canvas id="cam-canvas" class="hidden"></canvas>
      <div id="cam-status" class="absolute inset-0 flex items-center justify-center text-white/80 text-sm text-center px-6 font-body-main"></div>
      <div class="scan-line"></div>
      <div class="corner-bracket corner-tl"></div>
      <div class="corner-bracket corner-tr"></div>
      <div class="corner-bracket corner-bl"></div>
      <div class="corner-bracket corner-br"></div>
    </div>
    <div class="w-full max-w-md mt-8 px-6 flex items-center justify-between">
      <div class="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transition-all" id="scan-gallery-btn">
        <div class="w-14 h-14 bg-surface-container border-2 border-on-surface rounded-lg flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(0,0,0,0.1)]">
          <span class="material-symbols-outlined text-on-surface">photo_library</span>
        </div>
        <span class="font-label-caps text-[10px] text-on-surface-variant">GALLERY</span>
      </div>
      <button id="shutter-btn" class="shutter-btn w-20 h-20 bg-primary-container rounded-full border-4 border-white flex items-center justify-center outline outline-4 outline-primary-container/20">
        <div class="w-16 h-16 border-2 border-white/30 rounded-full flex items-center justify-center">
          <div class="w-8 h-8 bg-white/20 rounded-full"></div>
        </div>
      </button>
      <div class="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transition-all" id="scan-restart-btn">
        <div class="w-14 h-14 bg-surface-container border-2 border-on-surface rounded-full flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(0,0,0,0.1)]">
          <span class="material-symbols-outlined text-on-surface">cameraswitch</span>
        </div>
        <span class="font-label-caps text-[10px] text-on-surface-variant">RESTART</span>
      </div>
    </div>
    <div class="mt-8 px-8 py-3 bg-surface-container-low border border-outline-variant rounded-xl max-w-xs text-center shadow-[2px_2px_0px_0px_rgba(0,0,0,0.05)]">
      <p class="font-body-main text-sm italic text-on-surface-variant leading-tight">"Hold steady. For best results, make sure your meal is well lit."</p>
    </div>
  </div>`;
}

function mountScan() {
  const video = document.getElementById('cam-video');
  const status = document.getElementById('cam-status');
  const canvas = document.getElementById('cam-canvas');
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.protocol !== 'file:') {
    status.textContent = 'Camera requires HTTPS. Use "Gallery" to pick a photo instead.';
  } else {
    startCamera(video, status);
  }
  document.getElementById('scan-gallery-btn').onclick = () => navigate('upload');
  document.getElementById('scan-restart-btn').onclick = () => startCamera(video, status);
  document.getElementById('shutter-btn').onclick = () => {
    if (!mediaStream) { toast('Camera not active — try Gallery instead'); return; }
    const w = video.videoWidth || 480, h = video.videoHeight || 640;
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    // brief flash effect
    const flash = document.createElement('div');
    flash.className = 'fixed inset-0 bg-white z-[300] pointer-events-none';
    document.body.appendChild(flash);
    setTimeout(() => { flash.style.transition = 'opacity .3s'; flash.style.opacity = '0'; setTimeout(() => flash.remove(), 300); }, 40);
    openEntryForm(dataUrl);
  };
}

// ----- Upload/Gallery screen -----
function screenUpload() {
  return `
  <div class="max-w-md mx-auto">
    <div class="mb-8 text-center">
      <h2 class="font-headline-md text-2xl text-primary mb-1">Catalog Your Meal</h2>
      <p class="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest">Pick a photo from your gallery</p>
    </div>
    <label id="drop-zone" class="retro-card rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer border-dashed border-2 border-outline">
      <span class="material-symbols-outlined text-5xl text-primary mb-3">cloud_upload</span>
      <p class="font-body-main font-bold mb-1">Tap to choose a photo</p>
      <p class="font-label-caps text-[10px] text-on-surface-variant">JPG or PNG</p>
      <input id="file-input" type="file" accept="image/*" class="hidden"/>
    </label>
    <div id="upload-progress" class="hidden mt-6">
      <p class="font-headline-md text-lg text-primary mb-2 pb-2 dotted-rule">Vision Processor Status</p>
      <div class="w-full h-3 bg-surface-container-low rounded-full overflow-hidden border border-outline-variant">
        <div id="progress-bar" class="h-full bg-primary-container transition-all duration-300" style="width:0%"></div>
      </div>
      <p id="progress-label" class="font-label-caps text-[10px] text-on-surface-variant mt-2 text-center">ANALYZING IMAGE...</p>
    </div>
  </div>`;
}

function mountUpload() {
  const dz = document.getElementById('drop-zone');
  const input = document.getElementById('file-input');
  dz.addEventListener('click', (e) => { /* label already triggers input */ });
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const prog = document.getElementById('upload-progress');
      const bar = document.getElementById('progress-bar');
      const label = document.getElementById('progress-label');
      prog.classList.remove('hidden');
      let pct = 0;
      const iv = setInterval(() => {
        pct += 20;
        bar.style.width = pct + '%';
        if (pct >= 100) {
          clearInterval(iv);
          label.textContent = 'DONE — REVIEW YOUR ENTRY';
          setTimeout(() => openEntryForm(dataUrl), 250);
        }
      }, 180);
    };
    reader.readAsDataURL(file);
  });
}

// ----- Journal screen -----
function screenJournal() {
  const groups = {};
  [...state.entries].sort((a,b) => new Date(b.timeISO) - new Date(a.timeISO)).forEach(e => {
    (groups[e.date] = groups[e.date] || []).push(e);
  });
  const dates = Object.keys(groups).sort((a,b) => b.localeCompare(a));

  const last7 = state.entries.filter(e => {
    const d = new Date(e.date + 'T00:00:00');
    return (Date.now() - d.getTime()) <= 7*24*3600*1000;
  });
  const wk = {
    cal: sumField(last7,'calories'), pro: sumField(last7,'protein'),
    carb: sumField(last7,'carbs'), fat: sumField(last7,'fat')
  };

  return `
  <div class="mb-10 text-center">
    <h2 class="font-headline-md text-2xl text-primary mb-2">My Daily Journal</h2>
    <p class="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest">Tracking the flavors of life</p>
    <div class="w-24 h-1 bg-primary-container mx-auto mt-4 rounded-full"></div>
  </div>
  <div class="space-y-12">
    ${dates.length === 0 ? `<p class="text-center italic text-on-surface-variant py-10">No entries yet. Use Scan or Gallery to log your first meal.</p>` :
      dates.map(date => `
      <section>
        <div class="flex items-center mb-6">
          <div class="bg-primary-container text-on-primary w-10 h-10 rounded-full flex items-center justify-center mr-4 shadow-sm">
            <span class="material-symbols-outlined">${date === todayStr() ? 'calendar_today' : 'history'}</span>
          </div>
          <h3 class="font-headline-md text-xl text-primary">${date === todayStr() ? 'Today' : fmtDate(date)}</h3>
          <div class="flex-grow ml-4 border-b border-outline-variant opacity-50"></div>
        </div>
        <div class="space-y-6 ml-2 md:ml-12">
          ${groups[date].map(e => journalCard(e)).join('')}
        </div>
      </section>`).join('')}
  </div>
  <div class="mt-16 bg-surface-container border-2 border-primary-container p-6 rounded-xl shadow-[4px_4px_0px_0px_#a72703]">
    <div class="flex justify-between items-center mb-4">
      <h3 class="font-headline-md text-xl text-primary">7-Day Tally</h3>
      <span class="material-symbols-outlined text-primary">analytics</span>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="text-center"><p class="font-label-caps text-[10px] text-on-surface-variant mb-1">CALORIES</p><p class="font-display-lg-mobile text-xl text-primary">${wk.cal}</p></div>
      <div class="text-center"><p class="font-label-caps text-[10px] text-on-surface-variant mb-1">PROTEIN</p><p class="font-display-lg-mobile text-xl text-primary">${wk.pro}g</p></div>
      <div class="text-center"><p class="font-label-caps text-[10px] text-on-surface-variant mb-1">CARBS</p><p class="font-display-lg-mobile text-xl text-primary">${wk.carb}g</p></div>
      <div class="text-center"><p class="font-label-caps text-[10px] text-on-surface-variant mb-1">FATS</p><p class="font-display-lg-mobile text-xl text-primary">${wk.fat}g</p></div>
    </div>
  </div>`;
}

function journalCard(e) {
  const tagColor = { breakfast: 'bg-secondary-container text-on-secondary-fixed', lunch: 'bg-tertiary-container text-on-tertiary', dinner: 'bg-primary/10 text-primary border border-primary', snack: 'bg-surface-container-highest text-on-surface' };
  return `
  <article class="journal-log-entry retro-card p-card-padding rounded-lg flex flex-col md:flex-row gap-6">
    ${e.photo ? `<div class="w-full md:w-48 h-32 flex-shrink-0 rounded-md overflow-hidden border border-outline"><img class="w-full h-full object-cover" src="${e.photo}"/></div>`
      : `<div class="w-full md:w-48 h-32 flex-shrink-0 rounded-md overflow-hidden border border-outline bg-surface-container-low flex items-center justify-center"><span class="material-symbols-outlined text-4xl text-outline">restaurant</span></div>`}
    <div class="flex-grow min-w-0">
      <div class="flex justify-between items-start mb-2 gap-2">
        <h4 class="font-headline-md text-lg text-primary truncate">${escapeHtml(e.name)}</h4>
        <span class="font-label-caps text-[10px] ${tagColor[e.meal]||''} px-3 py-1 rounded sticker-tag flex-shrink-0">${e.meal.toUpperCase()}</span>
      </div>
      <div class="dotted-rule"></div>
      ${e.note ? `<p class="font-body-main text-on-surface-variant mb-3 italic">"${escapeHtml(e.note)}"</p>` : ''}
      <div class="flex flex-wrap gap-3 items-center">
        <div class="flex items-center gap-1 font-price-tag text-xs text-primary border border-primary/20 px-2 py-1 rounded"><span class="material-symbols-outlined text-sm">local_fire_department</span><span>${e.calories} KCAL</span></div>
        <div class="flex items-center gap-1 font-price-tag text-xs text-secondary border border-secondary/20 px-2 py-1 rounded"><span class="material-symbols-outlined text-sm">nutrition</span><span>P:${e.protein}g C:${e.carbs}g F:${e.fat}g</span></div>
        <button class="del-entry ml-auto material-symbols-outlined text-outline" data-id="${e.id}" title="Delete">delete</button>
      </div>
    </div>
  </article>`;
}

function mountJournal() {
  document.querySelectorAll('.del-entry').forEach(btn => btn.onclick = () => {
    state.entries = state.entries.filter(e => e.id !== btn.dataset.id);
    persistEntries();
    render();
    toast('Entry removed');
  });
}

// ----- Planning screen -----
function screenPlanning() {
  const dates = [...new Set(state.plans.map(p => p.date))].sort();
  const upcoming = dates.length ? dates : [todayStr()];
  return `
  <div class="mb-8 text-center">
    <h2 class="font-headline-md text-2xl text-primary mb-1">Daily Specials</h2>
    <p class="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-widest">Plan tomorrow's menu today</p>
  </div>
  <div class="retro-card p-card-padding rounded-xl mb-8">
    <h3 class="font-headline-md text-lg text-primary mb-3">Add a Planned Meal</h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label class="block sm:col-span-2">
        <span class="font-label-caps text-[10px] text-on-surface-variant">DATE</span>
        <input id="p-date" type="date" class="ledger-input mt-1" value="${todayStr()}"/>
      </label>
      <label class="block">
        <span class="font-label-caps text-[10px] text-on-surface-variant">MEAL</span>
        <select id="p-meal" class="ledger-input mt-1">
          <option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option>
        </select>
      </label>
      <label class="block">
        <span class="font-label-caps text-[10px] text-on-surface-variant">TARGET CALORIES</span>
        <input id="p-cal" type="number" class="ledger-input font-typewriter mt-1" value="400"/>
      </label>
      <label class="block sm:col-span-2">
        <span class="font-label-caps text-[10px] text-on-surface-variant">DISH NAME</span>
        <input id="p-name" class="ledger-input mt-1" placeholder="e.g. Grilled chicken bowl"/>
      </label>
    </div>
    <button id="p-add" class="pressable-button w-full mt-4 py-3 rounded-lg font-label-caps">ADD TO PLAN</button>
  </div>
  <div class="space-y-10">
    ${upcoming.map(date => {
      const items = state.plans.filter(p => p.date === date);
      if (!items.length) return '';
      return `
      <section>
        <div class="flex items-center mb-4">
          <div class="bg-secondary text-on-secondary w-9 h-9 rounded-full flex items-center justify-center mr-3"><span class="material-symbols-outlined text-lg">event</span></div>
          <h3 class="font-headline-md text-lg text-secondary">${date === todayStr() ? 'Today' : fmtDate(date)}</h3>
          <div class="flex-grow ml-4 border-b border-outline-variant opacity-50"></div>
        </div>
        <div class="space-y-3">
          ${items.map(p => planCard(p)).join('')}
        </div>
      </section>`;
    }).join('') || `<p class="text-center italic text-on-surface-variant py-6">No planned meals yet — add one above.</p>`}
  </div>`;
}

function planCard(p) {
  return `
  <div class="retro-card p-4 rounded-lg flex items-center justify-between gap-3 ${p.done ? 'opacity-60' : ''}">
    <label class="flex items-center gap-3 cursor-pointer flex-grow min-w-0">
      <input type="checkbox" class="plan-done w-5 h-5 accent-[#a72703]" data-id="${p.id}" ${p.done ? 'checked' : ''}/>
      <div class="min-w-0">
        <p class="font-body-main font-bold truncate ${p.done ? 'line-through' : ''}">${escapeHtml(p.name || 'Untitled dish')}</p>
        <p class="font-label-caps text-[10px] text-on-surface-variant">${p.meal.toUpperCase()} • ${p.calories} KCAL TARGET</p>
      </div>
    </label>
    <button class="del-plan material-symbols-outlined text-outline flex-shrink-0" data-id="${p.id}" title="Remove">delete</button>
  </div>`;
}

function mountPlanning() {
  document.getElementById('p-add').onclick = () => {
    const name = document.getElementById('p-name').value.trim();
    const date = document.getElementById('p-date').value || todayStr();
    const meal = document.getElementById('p-meal').value;
    const calories = Number(document.getElementById('p-cal').value) || 0;
    if (!name) { toast('Give the dish a name first'); return; }
    state.plans.unshift({ id: uid(), date, meal, name, calories, done: false });
    persistPlans();
    render();
    toast('Added to plan');
  };
  document.querySelectorAll('.plan-done').forEach(cb => cb.onchange = () => {
    const plan = state.plans.find(p => p.id === cb.dataset.id);
    if (plan) {
      plan.done = cb.checked;
      persistPlans();
      if (plan.done) {
        // Convenience: also drop it into today's journal as a real logged entry
        state.entries.unshift({
          id: uid(), date: todayStr(), timeISO: new Date().toISOString(),
          name: plan.name, meal: plan.meal, calories: plan.calories,
          protein: 0, carbs: 0, fat: 0, note: 'Logged from meal plan', photo: null
        });
        persistEntries();
        toast('Marked done & logged to journal');
      }
      render();
    }
  });
  document.querySelectorAll('.del-plan').forEach(btn => btn.onclick = () => {
    state.plans = state.plans.filter(p => p.id !== btn.dataset.id);
    persistPlans();
    render();
    toast('Plan removed');
  });
}

// ---------- Render dispatcher ----------
function render() {
  const app = document.getElementById('app');
  document.getElementById('today-label').textContent = fmtDate(todayStr());
  switch (state.route) {
    case 'scan': app.innerHTML = screenScan(); mountScan(); break;
    case 'upload': app.innerHTML = screenUpload(); mountUpload(); break;
    case 'journal': app.innerHTML = screenJournal(); mountJournal(); break;
    case 'planning': app.innerHTML = screenPlanning(); mountPlanning(); break;
    default: app.innerHTML = screenHome(); mountHome(); break;
  }
}

// ---------- Init ----------
navigate('home');

// Register service worker for offline/installable use
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
