const auth = firebase.auth();
const db   = firebase.database();

let balance     = 0;
let spinning    = false;
let currentUser = null;

const CELL_H       = 80;   // px per symbol cell
const STRIP_LEN    = 30;   // symbols per strip
const WINNER_IDX   = 27;   // which index lands in the center win-line

// symbol definitions — weights sum to 100, payouts tuned for ~95% RTP
// pay3 = multiplier for 3-of-a-kind, pay2 = multiplier for any pair
const SYMBOLS = [
  { icon: "🍒", label: "Cherry",  weight: 32,  pay3: 5,   pay2: 1.2 },
  { icon: "🍋", label: "Lemon",   weight: 24,  pay3: 5,   pay2: 1.1 },
  { icon: "🍊", label: "Orange",  weight: 18,  pay3: 7,   pay2: 1.1 },
  { icon: "🍇", label: "Grapes",  weight: 12,  pay3: 10,  pay2: 2   },
  { icon: "🔔", label: "Bell",    weight: 8,   pay3: 18,  pay2: 3   },
  { icon: "💰", label: "Money",   weight: 4,   pay3: 35,  pay2: 6   },
  { icon: "💎", label: "Diamond", weight: 1.5, pay3: 80,  pay2: 12  },
  { icon: "7️⃣", label: "Seven",  weight: 0.5, pay3: 150, pay2: 25  },
];

const TOTAL_WEIGHT = SYMBOLS.reduce((s, x) => s + x.weight, 0);

function randSymbol() {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const s of SYMBOLS) { r -= s.weight; if (r <= 0) return s; }
  return SYMBOLS[0];
}

// ── Build a reel strip with winner at WINNER_IDX ──────────────────────────
function buildStrip(stripEl, winner) {
  stripEl.innerHTML = "";
  for (let i = 0; i < STRIP_LEN; i++) {
    const cell = document.createElement("div");
    cell.className = "symbol-cell";
    cell.textContent = (i === WINNER_IDX) ? winner.icon : randSymbol().icon;
    if (i === WINNER_IDX) cell.dataset.isWinner = "1";
    stripEl.appendChild(cell);
  }
}

function getStrip(i) { return document.getElementById("strip-" + i); }

// ── Spin ──────────────────────────────────────────────────────────────────
function spin() {
  if (spinning) return;

  const bet = parseFloat(document.getElementById("bet-input").value);
  if (isNaN(bet) || bet <= 0) { showMsg("Enter a valid bet.", "#e74c3c"); return; }
  if (bet > balance)           { showMsg("Insufficient balance.", "#e74c3c"); return; }

  spinning = true;
  document.getElementById("spin-btn").disabled = true;
  showMsg("", "");

  balance -= bet;
  saveBalance();
  refreshBalance();

  const winners = [randSymbol(), randSymbol(), randSymbol()];
  const finalY  = -((WINNER_IDX - 1) * CELL_H);   // winner lands in center

  // Rebuild strips, snap to top (no transition), then animate
  for (let i = 0; i < 3; i++) {
    const s = getStrip(i);
    s.style.transition = "none";
    buildStrip(s, winners[i]);
    s.style.transform = "translateY(0)";
  }

  // Let browser paint the snapped position, then start animations
  setTimeout(() => {
    for (let i = 0; i < 3; i++) {
      const dur = 1.4 + i * 0.45;
      const s = getStrip(i);
      s.style.transition = `transform ${dur}s cubic-bezier(0.25, 1, 0.35, 1)`;
      s.style.transform  = `translateY(${finalY}px)`;
    }

    const lastDur = 1.4 + 2 * 0.45 + 0.25;
    setTimeout(() => {
      evaluate(winners, bet);
      spinning = false;
      document.getElementById("spin-btn").disabled = false;
    }, lastDur * 1000);
  }, 60);
}

// ── Result evaluation ─────────────────────────────────────────────────────
function evaluate(w, bet) {
  const [a, b, c] = w;

  if (a.icon === b.icon && b.icon === c.icon) {
    const win    = +(bet * a.pay3).toFixed(2);
    const profit = +(win - bet).toFixed(2);
    balance += win;
    saveBalance();
    refreshBalance();
    flashReels([0, 1, 2]);
    showMsg(`🎉 ${a.label}! +$${profit.toFixed(2)}`, "#ffd700");
    return;
  }

  // All symbols now have pair payouts
  const pairs = [
    { reels: [0,1], sym: a, match: a.icon === b.icon },
    { reels: [1,2], sym: b, match: b.icon === c.icon },
    { reels: [0,2], sym: a, match: a.icon === c.icon },
  ].filter(p => p.match);

  if (pairs.length) {
    const best   = pairs.reduce((x, y) => y.sym.pay2 > x.sym.pay2 ? y : x);
    const win    = +(bet * best.sym.pay2).toFixed(2);
    const profit = +(win - bet).toFixed(2);
    balance += win;
    saveBalance();
    refreshBalance();
    flashReels(best.reels);
    const msg = profit > 0
      ? `✨ ${best.sym.label} pair! +$${profit.toFixed(2)}`
      : `↩️ ${best.sym.label} pair — bet returned`;
    showMsg(msg, profit > 0 ? "#4caf82" : "#aaa");
    return;
  }

  showMsg(`❌ No match. -$${bet.toFixed(2)}`, "#e74c3c");
}

function flashReels(indices) {
  indices.forEach(i => {
    const cell = getStrip(i).querySelector("[data-is-winner='1']");
    if (!cell) return;
    cell.classList.add("winning");
    setTimeout(() => cell.classList.remove("winning"), 1800);
  });
}

// ── Bet helpers ───────────────────────────────────────────────────────────
function halveBet() {
  const el  = document.getElementById("bet-input");
  const val = parseFloat(el.value) || 1;
  el.value  = Math.max(0.01, val / 2).toFixed(2);
}
function doubleBet() {
  const el  = document.getElementById("bet-input");
  const val = parseFloat(el.value) || 1;
  el.value  = (val * 2).toFixed(2);
}

// ── Helpers ───────────────────────────────────────────────────────────────
function showMsg(text, color) {
  const el   = document.getElementById("message");
  el.textContent = text;
  el.style.color = color;
}

function refreshBalance() {
  document.getElementById("balance").textContent = balance.toFixed(2);
}

function saveBalance() {
  if (currentUser) db.ref("users/" + currentUser.uid + "/points").set(balance);
}

// ── Init reels on load ────────────────────────────────────────────────────
function initReels() {
  const midY = -((Math.floor(STRIP_LEN / 2) - 1) * CELL_H);
  for (let i = 0; i < 3; i++) {
    const s = getStrip(i);
    s.style.transition = "none";
    buildStrip(s, randSymbol());
    s.style.transform = `translateY(${midY}px)`;
  }
}

// ── Decorative lights ─────────────────────────────────────────────────────
function initLights() {
  const colors = ["#ff4d4d", "#ffd700", "#44ff99", "#4d9eff", "#ff88cc"];
  const container = document.getElementById("lights");
  for (let i = 0; i < 10; i++) {
    const dot = document.createElement("span");
    dot.className = "light";
    dot.style.color      = colors[i % colors.length];
    dot.style.background = colors[i % colors.length];
    dot.style.animationDelay = (i * 0.12) + "s";
    dot.style.animation  = `blink-light 1s ${(i * 0.12).toFixed(2)}s infinite`;
    container.appendChild(dot);
  }
}

// inject the keyframe once
const ks = document.createElement("style");
ks.textContent = `
  @keyframes blink-light {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.15; }
  }
`;
document.head.appendChild(ks);

// ── Paytable ──────────────────────────────────────────────────────────────
function buildPaytable() {
  const grid = document.getElementById("paytable-grid");
  [...SYMBOLS].reverse().forEach(s => {
    const row = document.createElement("div");
    row.className = "pay-row";
    row.innerHTML = `
      <span class="pay-icon">${s.icon}</span>
      <div class="pay-info">
        <span class="pay-label">${s.label}</span>
        <span class="pay-amount">${s.pay3}× / ${s.pay2 > 0 ? s.pay2 + "× pair" : "—"}</span>
      </div>`;
    grid.appendChild(row);
  });
}

// ── Auth ──────────────────────────────────────────────────────────────────
auth.onAuthStateChanged(user => {
  if (!user) { window.location.href = "index.html"; return; }
  currentUser = user;

  db.ref("users/" + user.uid + "/points").once("value").then(snap => {
    balance = parseFloat(snap.val()) || 1000;
    refreshBalance();
  });

  const icon     = document.getElementById("profile-icon");
  const dropdown = document.getElementById("dropdown");

  db.ref("users/" + user.uid + "/profileImage").once("value").then(snap => {
    const img = snap.val();
    icon.innerHTML = "";
    if (img) {
      const el = document.createElement("img");
      el.src = img;
      el.style.cssText = "width:100%;height:100%;border-radius:50%;object-fit:cover";
      icon.appendChild(el);
    } else {
      icon.textContent = user.email[0].toUpperCase();
    }
    icon.title = user.email;
  });

  icon.onclick = () => dropdown.classList.toggle("hidden");
});

document.addEventListener("click", e => {
  const w = document.getElementById("profile-wrapper");
  if (!w.contains(e.target)) document.getElementById("dropdown").classList.add("hidden");
});

function logout()      { auth.signOut().then(() => window.location.href = "index.html"); }
function viewProfile() { window.location.href = "profile.html"; }

// ── Boot ──────────────────────────────────────────────────────────────────
initReels();
initLights();
buildPaytable();
