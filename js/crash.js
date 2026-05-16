const auth = firebase.auth();
const db   = firebase.database();

let balance     = 0;
let currentUser = null;

// ── Game state ────────────────────────────────────────────────────────────
const STATE = { IDLE: 'idle', FLYING: 'flying', CRASHED: 'crashed' };
let state      = STATE.IDLE;
let currentBet    = 0;
let hasBet        = false;
let cashedOut     = false;
let cashedOutMult = 0;
let cashedOutProfit = 0;

let crashPoint = 1;
let startTime  = 0;
let currentMult = 1;
let rafId      = null;

// Growth constant — reaches 2× in ~6.9s, 10× in ~23s
const K = 0.0001;
function multAtMs(ms)  { return Math.exp(K * ms); }
function msAtMult(m)   { return Math.log(m) / K; }

// ── Crash point formula (matches Stake's house edge: 1%) ─────────────────
function genCrashPoint() {
  const r = Math.random();
  if (r >= 0.99) return 1.00;          // 1% instant crash
  return Math.max(1.01, 0.99 / (1 - r));
  // P(crash > x) = 1/x  →  E[return] = 0.99 (99% RTP)
}

// ── Round history ─────────────────────────────────────────────────────────
const history = [];   // { crash, playerMult, profit }

function pushHistory(crash, playerMult, profit) {
  history.unshift({ crash, playerMult, profit });
  if (history.length > 12) history.pop();
  renderHistory();
}

function renderHistory() {
  const el = document.getElementById("bet-history");
  el.innerHTML = "";
  history.forEach(h => {
    const chip  = document.createElement("div");
    const cashed = h.cashedAt !== null;
    const cls   = cashed
      ? (h.profit > 0 ? "high" : "mid")
      : (h.crash < 2 ? "low" : "mid");
    chip.className = "history-chip " + cls;

    const profitTxt = h.profit !== null
      ? (h.profit >= 0 ? `+$${h.profit.toFixed(2)}` : `-$${Math.abs(h.profit).toFixed(2)}`)
      : "";

    const rightTxt = cashed
      ? `✅ Out ${h.cashedAt.toFixed(2)}× &nbsp;${profitTxt}`
      : `❌ Bust &nbsp;${profitTxt}`;

    chip.innerHTML = `
      <span class="h-crash">💥 ${h.crash.toFixed(2)}×</span>
      <span class="h-result">${rightTxt}</span>`;
    el.appendChild(chip);
  });
}

// ── Balance ───────────────────────────────────────────────────────────────
function saveBalance() {
  if (currentUser) db.ref("users/" + currentUser.uid + "/points").set(balance);
}
function refreshBalance() {
  document.getElementById("balance").textContent = balance.toFixed(2);
}

// ── Button state manager ──────────────────────────────────────────────────
function setBtns(phase, amount) {
  const bet     = document.getElementById("bet-btn");
  const cashout = document.getElementById("cashout-btn");
  if (phase === "idle") {
    bet.disabled     = false;
    cashout.disabled = true;
    cashout.textContent = "Cash Out — $0.00";
  } else if (phase === "flying") {
    bet.disabled     = true;
    cashout.disabled = false;
    cashout.textContent = `Cash Out — $${amount.toFixed(2)}`;
  } else if (phase === "over") {
    bet.disabled     = true;
    cashout.disabled = true;
    cashout.textContent = "Cash Out — $0.00";
  }
}

// ── Bet controls ──────────────────────────────────────────────────────────
function halveBet() {
  const el = document.getElementById("bet-input");
  el.value = Math.max(0.01, parseFloat(el.value) / 2).toFixed(2);
}
function doubleBet() {
  const el = document.getElementById("bet-input");
  el.value = (parseFloat(el.value) * 2).toFixed(2);
}

// ── Place bet ─────────────────────────────────────────────────────────────
function placeBet() {
  if (state !== STATE.IDLE) return;

  const bet = parseFloat(document.getElementById("bet-input").value);
  if (isNaN(bet) || bet <= 0) { setStatus("Enter a valid bet.", "#e74c3c"); return; }
  if (bet > balance)           { setStatus("Insufficient balance.", "#e74c3c"); return; }

  currentBet = bet;
  hasBet     = true;
  cashedOut  = false;
  balance   -= bet;
  saveBalance();
  refreshBalance();

  setBtns("flying", bet);
  setStatus("🚀 Flying!", "#22c55e");

  launchRound();
}

// ── Cash out ──────────────────────────────────────────────────────────────
function cashOut() {
  if (state !== STATE.FLYING || !hasBet || cashedOut) return;
  cashedOut = true;

  const payout = currentBet * currentMult;
  const profit = payout - currentBet;
  balance += payout;
  saveBalance();
  refreshBalance();

  cashedOutMult   = currentMult;
  cashedOutProfit = profit;

  setBtns("over");
  setMult(currentMult.toFixed(2) + "×", "cashed");
  setStatus(`✅ Cashed out at ${currentMult.toFixed(2)}× — +$${profit.toFixed(2)}`, "#ffd700");
}

// ── Round loop ────────────────────────────────────────────────────────────
function launchRound() {
  crashPoint = genCrashPoint();
  startTime  = performance.now();
  state      = STATE.FLYING;

  setMult("1.00×", "");
  setSub("");
  clearCanvas();

  rafId = requestAnimationFrame(tick);
}

function tick(now) {
  const elapsed = now - startTime;
  currentMult = multAtMs(elapsed);

  // Auto cashout
  const autoOn  = document.getElementById("auto-toggle").checked;
  const autoTgt = parseFloat(document.getElementById("auto-target").value);
  if (autoOn && !cashedOut && hasBet && !isNaN(autoTgt) && currentMult >= autoTgt) {
    cashOut();
  }

  // Crashed?
  if (currentMult >= crashPoint) {
    currentMult = crashPoint;
    drawFrame(elapsed, true);
    handleCrash();
    return;
  }

  // Update cashout button live amount
  if (hasBet && !cashedOut) {
    document.getElementById("cashout-btn").textContent =
      `Cash Out — $${(currentBet * currentMult).toFixed(2)}`;
  }


  setMult(currentMult.toFixed(2) + "×", "");
  drawFrame(elapsed, false);
  rafId = requestAnimationFrame(tick);
}

function handleCrash() {
  state = STATE.CRASHED;
  cancelAnimationFrame(rafId);

  setMult(crashPoint.toFixed(2) + "×", "crashed");
  setSub("💥 Crashed!");

  let profit = null;
  if (hasBet && !cashedOut) {
    profit = -currentBet;
    setStatus(`💥 Crashed at ${crashPoint.toFixed(2)}×. Lost $${currentBet.toFixed(2)}`, "#e74c3c");
  }

  if (hasBet) {
    if (cashedOut) {
      pushHistory(crashPoint, cashedOutMult, cashedOutProfit);
    } else {
      pushHistory(crashPoint, null, -currentBet);
    }
  }

  setBtns("over");

  // Reset after 3s
  setTimeout(() => {
    state           = STATE.IDLE;
    hasBet          = false;
    cashedOut       = false;
    cashedOutMult   = 0;
    cashedOutProfit = 0;
    currentMult     = 1;
    setBtns("idle");
    setMult("—", "");
    setSub("Place your bet to start");
    setStatus("", "");
    clearCanvas();
  }, 3000);
}

// ── Canvas drawing ────────────────────────────────────────────────────────
const canvas = document.getElementById("crashCanvas");
const ctx    = canvas.getContext("2d");

const PAD = { top: 20, right: 20, bottom: 38, left: 52 };

function resizeCanvas() {
  const wrap = canvas.parentElement;
  canvas.width  = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
}

function clearCanvas() {
  resizeCanvas();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid(2, 1);   // draw idle grid at 1× baseline
}

function drawFrame(elapsed, crashed) {
  resizeCanvas();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const W = canvas.width  - PAD.left - PAD.right;
  const H = canvas.height - PAD.top  - PAD.bottom;

  // Scale: show 10% extra headroom above current mult
  const yMax  = Math.max(1.5, currentMult * 1.15);
  const xMax  = Math.max(8000, elapsed * 1.12);   // ms

  drawGrid(yMax, xMax);

  // Build path
  ctx.beginPath();
  let first = true;
  const steps = Math.max(100, Math.floor(elapsed / 50));
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * elapsed;
    const m = multAtMs(t);
    const x = PAD.left + (t / xMax) * W;
    const y = PAD.top  + H - ((m - 1) / (yMax - 1)) * H;
    first ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    first = false;
  }

  const lastX = PAD.left + (elapsed / xMax) * W;
  const lastY = PAD.top  + H - ((currentMult - 1) / (yMax - 1)) * H;

  // Filled area under curve
  ctx.lineTo(lastX, PAD.top + H);
  ctx.lineTo(PAD.left, PAD.top + H);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + H);
  const color = crashed ? "#e74c3c" : "#22c55e";
  grad.addColorStop(0, color + "40");
  grad.addColorStop(1, color + "08");
  ctx.fillStyle = grad;
  ctx.fill();

  // Curve line
  ctx.beginPath();
  first = true;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * elapsed;
    const m = multAtMs(t);
    const x = PAD.left + (t / xMax) * W;
    const y = PAD.top  + H - ((m - 1) / (yMax - 1)) * H;
    first ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    first = false;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth   = 3;
  ctx.lineJoin    = "round";
  ctx.stroke();

  // Dot at tip
  if (!crashed) {
    ctx.beginPath();
    ctx.arc(lastX, lastY, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(lastX, lastY, 10, 0, Math.PI * 2);
    ctx.fillStyle = color + "40";
    ctx.fill();
  }
}

function drawGrid(yMax, xMaxMs) {
  const W = canvas.width  - PAD.left - PAD.right;
  const H = canvas.height - PAD.top  - PAD.bottom;

  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.fillStyle   = "rgba(255,255,255,0.2)";
  ctx.font        = "11px 'Segoe UI', Arial, sans-serif";
  ctx.lineWidth   = 1;

  // Y axis — pick nice multiplier labels
  const yTicks = niceMultTicks(yMax);
  yTicks.forEach(m => {
    if (m < 1 || m > yMax) return;
    const y = Math.round(PAD.top + H - ((m - 1) / (yMax - 1)) * H) + 0.5;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + W, y);
    ctx.stroke();
    ctx.fillText(m.toFixed(m >= 10 ? 0 : 1) + "×", 4, y + 4);
  });

  // X axis — seconds
  const xMaxS = xMaxMs / 1000;
  const xStep = niceTimeStep(xMaxS);
  for (let s = 0; s <= xMaxS; s += xStep) {
    const x = Math.round(PAD.left + (s / xMaxS) * W) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, PAD.top);
    ctx.lineTo(x, PAD.top + H);
    ctx.stroke();
    ctx.fillText(s + "s", x - 8, PAD.top + H + 16);
  }
}

function niceMultTicks(yMax) {
  const candidates = [1, 1.5, 2, 3, 5, 10, 20, 50, 100, 200, 500, 1000];
  return candidates.filter(v => v <= yMax * 1.05);
}

function niceTimeStep(maxS) {
  if (maxS <= 15)  return 2;
  if (maxS <= 40)  return 5;
  if (maxS <= 120) return 10;
  return 30;
}

// ── Overlay helpers ───────────────────────────────────────────────────────
function setMult(txt, cls) {
  const el = document.getElementById("mult-value");
  el.textContent  = txt;
  el.className    = "mult-value " + cls;
}
function setSub(txt) {
  const el = document.getElementById("mult-sub");
  el.textContent = txt;
  el.className   = "mult-sub" + (txt.includes("s") ? " counting" : "");
}
function setStatus(txt, color) {
  const el = document.getElementById("panel-status");
  el.textContent  = txt;
  el.style.color  = color;
}

// ── Auth + profile ────────────────────────────────────────────────────────
auth.onAuthStateChanged(user => {
  if (!user) { window.location.href = "index.html"; return; }
  currentUser = user;

  db.ref("users/" + user.uid + "/points").once("value").then(snap => {
    balance = parseFloat(snap.val()) || 0;
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

window.addEventListener("resize", () => { if (state === STATE.IDLE) clearCanvas(); });

clearCanvas();
