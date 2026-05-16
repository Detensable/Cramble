const auth = firebase.auth();
const db   = firebase.database();

let balance     = 0;
let currentUser = null;

// game state
let gameActive    = false;
let minePositions = new Set();
let revealed      = new Set();
let currentBet    = 0;
let mineCount     = 3;
let currentMode   = 'manual';

// auto state
let autoRunning   = false;
let autoRoundsLeft = 0;
let autoPicksLeft  = 0;

// ── Math: Stake-accurate multiplier using combinations ────────────────────
function nCr(n, r) {
  if (r < 0 || r > n) return 0;
  if (r === 0 || r === n) return 1;
  r = Math.min(r, n - r);
  let result = 1;
  for (let i = 0; i < r; i++) {
    result *= (n - i) / (i + 1);
  }
  return result;
}

// 1% house edge matches Stake
function calcMultiplier(mines, gemsFound) {
  if (gemsFound === 0) return 1;
  return 0.99 * nCr(25, gemsFound) / nCr(25 - mines, gemsFound);
}

// ── Balance helpers ───────────────────────────────────────────────────────
function saveBalance() {
  if (currentUser) db.ref("users/" + currentUser.uid + "/points").set(balance);
}

function refreshBalance() {
  document.getElementById("balance").textContent = balance.toFixed(2);
}

// ── Mine preset chips ─────────────────────────────────────────────────────
function setMinePreset(n) {
  mineCount = n;
  document.getElementById("mines-input").value = n;
  document.getElementById("mine-label").textContent = n;
  document.querySelectorAll(".mine-presets button").forEach(b => b.classList.remove("preset-active"));
  event.target.classList.add("preset-active");
}

function syncMineInput() {
  let n = parseInt(document.getElementById("mines-input").value);
  if (isNaN(n) || n < 1) n = 1;
  if (n > 24) n = 24;
  mineCount = n;
  document.getElementById("mine-label").textContent = n;
  document.querySelectorAll(".mine-presets button").forEach(b => {
    b.classList.toggle("preset-active", parseInt(b.textContent) === n);
  });
}

// ── Bet helpers ───────────────────────────────────────────────────────────
function halveBet() {
  const el = document.getElementById("bet-input");
  el.value = Math.max(0.01, parseFloat(el.value) / 2).toFixed(2);
}
function doubleBet() {
  const el = document.getElementById("bet-input");
  el.value = (parseFloat(el.value) * 2).toFixed(2);
}

// ── Mode toggle ───────────────────────────────────────────────────────────
function setMode(mode) {
  currentMode = mode;
  document.getElementById("tab-manual").classList.toggle("active", mode === "manual");
  document.getElementById("tab-auto").classList.toggle("active", mode === "auto");

  document.getElementById("play-btn").classList.toggle("hidden", mode === "auto");
  document.getElementById("start-auto-btn").classList.toggle("hidden", mode === "manual");
  document.getElementById("auto-rounds-group").classList.toggle("hidden", mode === "manual");
  document.getElementById("auto-picks-group").style.display = mode === "auto" ? "flex" : "none";
}

// ── Build grid ────────────────────────────────────────────────────────────
function buildGrid() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";
  for (let i = 0; i < 25; i++) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.dataset.index = i;
    tile.addEventListener("click", () => handleClick(i));
    grid.appendChild(tile);
  }
}

function getTile(i) {
  return document.querySelector(`.tile[data-index="${i}"]`);
}

// ── Start game ────────────────────────────────────────────────────────────
function startGame() {
  const bet = parseFloat(document.getElementById("bet-input").value);
  if (isNaN(bet) || bet <= 0) { showResult("Enter a valid bet.", "lose"); return; }
  if (bet > balance)           { showResult("Insufficient balance.", "lose"); return; }

  const mines = parseInt(document.getElementById("mines-input").value);
  if (isNaN(mines) || mines < 1 || mines > 24) { showResult("Mines must be 1–24.", "lose"); return; }

  mineCount  = mines;
  currentBet = bet;
  balance   -= bet;
  saveBalance();
  refreshBalance();

  // Place mines randomly
  minePositions.clear();
  revealed.clear();
  while (minePositions.size < mineCount) {
    minePositions.add(Math.floor(Math.random() * 25));
  }

  gameActive = true;
  buildGrid();
  hideResult();
  updateLiveStats();

  document.getElementById("live-stats").classList.remove("hidden");
  document.getElementById("play-btn").disabled = true;
  document.getElementById("cashout-btn").disabled = false;
  document.getElementById("pick-btn").classList.toggle("hidden", currentMode === "auto");
}

// ── Handle tile click ─────────────────────────────────────────────────────
function handleClick(index) {
  if (!gameActive) return;
  if (revealed.has(index)) return;

  const tile = getTile(index);

  if (minePositions.has(index)) {
    // Hit a mine
    tile.textContent = "💣";
    tile.classList.add("mine");
    gameActive = false;
    revealAllMines(index);
    showResult(`💥 Boom! Lost $${currentBet.toFixed(2)}`, "lose");
    endGame(false);
  } else {
    // Safe tile
    revealed.add(index);
    tile.textContent = "💎";
    tile.classList.add("revealed");
    updateLiveStats();
    checkAllSafeRevealed();
  }
}

function revealAllMines(hitIndex) {
  let delay = 0;
  minePositions.forEach(i => {
    if (i === hitIndex) return;
    setTimeout(() => {
      const t = getTile(i);
      t.textContent = "💣";
      t.classList.add("mine-late");
    }, delay += 60);
  });
  // Dim unrevealed safe tiles
  setTimeout(() => {
    for (let i = 0; i < 25; i++) {
      if (!minePositions.has(i) && !revealed.has(i)) {
        getTile(i).classList.add("inactive");
      }
    }
  }, minePositions.size * 60 + 80);
}

function checkAllSafeRevealed() {
  const safeTiles = 25 - mineCount;
  if (revealed.size === safeTiles) {
    // Auto-cashout on complete board clear
    cashOut();
    showResult(`🏆 Board cleared! +$${(currentBet * calcMultiplier(mineCount, revealed.size) - currentBet).toFixed(2)}`, "win");
  }
}

// ── Cash out ──────────────────────────────────────────────────────────────
function cashOut() {
  if (!gameActive) return;
  gameActive = false;

  const mult   = calcMultiplier(mineCount, revealed.size);
  const payout = currentBet * mult;
  const profit = payout - currentBet;

  balance += payout;
  saveBalance();
  refreshBalance();

  revealAllMinesAfterCashout();
  showResult(`✅ Cashed out ${mult.toFixed(2)}× — +$${profit.toFixed(2)}`, "win");
  endGame(true);
}

function revealAllMinesAfterCashout() {
  let delay = 0;
  minePositions.forEach(i => {
    setTimeout(() => {
      const t = getTile(i);
      if (!t.classList.contains("mine")) {
        t.textContent = "💣";
        t.classList.add("mine-late");
      }
    }, delay += 50);
  });
}

function endGame(won) {
  document.getElementById("play-btn").disabled = false;
  document.getElementById("cashout-btn").disabled = true;
  document.getElementById("pick-btn").classList.add("hidden");
  document.getElementById("live-stats").classList.add("hidden");

  // Make all tiles non-interactive
  document.querySelectorAll(".tile:not(.revealed):not(.mine):not(.mine-late)").forEach(t => {
    t.classList.add("inactive");
  });

  if (autoRunning) scheduleNextAutoRound(won);
}

// ── Live stats ────────────────────────────────────────────────────────────
function updateLiveStats() {
  const gems    = revealed.size;
  const mult    = calcMultiplier(mineCount, gems);
  const profit  = currentBet * mult - currentBet;
  const nextMult = calcMultiplier(mineCount, gems + 1);
  const nextProfit = currentBet * nextMult - currentBet;
  const safeLeft = (25 - mineCount) - gems;

  document.getElementById("mult-display").textContent = mult.toFixed(2) + "×";
  document.getElementById("profit-display").textContent = "+" + profit.toFixed(2);
  document.getElementById("next-display").textContent =
    safeLeft > 0 ? `${nextMult.toFixed(2)}× (+$${nextProfit.toFixed(2)})` : "—";
  document.getElementById("gems-found").textContent = gems;
  document.getElementById("safe-left").textContent = safeLeft;

  // Update cashout button label
  document.getElementById("cashout-btn").textContent =
    `Cash Out — $${(currentBet * mult).toFixed(2)}`;
}

// ── Auto-pick ─────────────────────────────────────────────────────────────
function autoPick() {
  if (!gameActive) return;
  const unrevealed = [];
  for (let i = 0; i < 25; i++) {
    if (!revealed.has(i) && !minePositions.has(i) && !revealedAsMine(i)) {
      unrevealed.push(i);
    }
  }
  // Pick from ALL unrevealed tiles (including mines — realistic random pick)
  const allUnrevealed = [];
  for (let i = 0; i < 25; i++) {
    if (!revealed.has(i) && !getTile(i).classList.contains("mine") && !getTile(i).classList.contains("mine-late")) {
      allUnrevealed.push(i);
    }
  }
  if (allUnrevealed.length === 0) return;
  const pick = allUnrevealed[Math.floor(Math.random() * allUnrevealed.length)];
  handleClick(pick);
}

function revealedAsMine(i) {
  const t = getTile(i);
  return t && (t.classList.contains("mine") || t.classList.contains("mine-late"));
}

// ── Auto mode ─────────────────────────────────────────────────────────────
function startAuto() {
  const rounds = parseInt(document.getElementById("auto-rounds-input").value);
  if (isNaN(rounds) || rounds < 1) { showResult("Enter valid round count.", "lose"); return; }

  autoRunning    = true;
  autoRoundsLeft = rounds;

  document.getElementById("start-auto-btn").classList.add("hidden");
  document.getElementById("stop-auto-btn").classList.remove("hidden");

  runAutoRound();
}

function runAutoRound() {
  if (!autoRunning || autoRoundsLeft <= 0) {
    stopAuto();
    return;
  }
  autoRoundsLeft--;
  const picks = parseInt(document.getElementById("auto-picks-input").value) || 3;
  autoPicksLeft = picks;
  startGame();
  scheduleAutoPick();
}

function scheduleAutoPick() {
  if (!autoRunning || !gameActive || autoPicksLeft <= 0) {
    if (gameActive) setTimeout(cashOut, 400);
    return;
  }
  setTimeout(() => {
    if (!gameActive) return;
    autoPicksLeft--;
    autoPick();
    if (gameActive) scheduleAutoPick();
  }, 500);
}

function scheduleNextAutoRound(won) {
  if (!autoRunning || autoRoundsLeft <= 0) { stopAuto(); return; }
  setTimeout(runAutoRound, 900);
}

function stopAuto() {
  autoRunning = false;
  document.getElementById("start-auto-btn").classList.remove("hidden");
  document.getElementById("stop-auto-btn").classList.add("hidden");
}

// ── Result banner ─────────────────────────────────────────────────────────
function showResult(msg, type) {
  const el = document.getElementById("round-result");
  el.textContent = msg;
  el.className = "round-result " + type;
}

function hideResult() {
  document.getElementById("round-result").className = "round-result hidden";
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

// Init grid
buildGrid();
