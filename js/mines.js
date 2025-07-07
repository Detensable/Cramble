// Elements
const gridEl = document.getElementById("grid");
const playBtn = document.getElementById("playBtn");
const cashOutBtn = document.getElementById("cashOutBtn");
const betInput = document.getElementById("betAmount");
const mineCountInput = document.getElementById("mineCountInput");
const profitDisplay = document.getElementById("profit");

// Manual/Auto Toggle
const manualBtn = document.getElementById("manualBtn");
const autoBtn = document.getElementById("autoBtn");
const manualControls = document.getElementById("manualControls");
const autoControls = document.getElementById("autoControls");

// Auto elements
const autoBet = document.getElementById("autoBet");
const autoMineCount = document.getElementById("autoMineCount");
const autoPlays = document.getElementById("autoPlays");
const startAutoBtn = document.getElementById("startAutoBtn");
const stopAutoBtn = document.getElementById("stopAutoBtn");

const auth = firebase.auth();
const db = firebase.database();

let currentUser = null;
let balance = 0;

function updateBalanceDisplay() {
  document.getElementById("balance").textContent = balance.toFixed(2);
}

function loadBalance() {
  if (!currentUser) return;
  const ref = db.ref("users/" + currentUser.uid + "/points");
  ref.once("value").then(snapshot => {
    balance = parseFloat(snapshot.val()) || 0;
    updateBalanceDisplay();
  });
}

function setBalance(newBalance) {
  if (!currentUser) return;
  balance = newBalance;
  db.ref("users/" + currentUser.uid).update({ balance: balance.toFixed(2) });
  updateBalanceDisplay();
}
auth.onAuthStateChanged(u => {
  if (!u) return window.location.href = "index.html";
  user = u;

  db.ref("users/" + user.uid + "/points").once("value").then(snapshot => {
    balance = snapshot.val() ?? 1000;
    updateBalanceDisplay();
  });

  // profile logic
  const icon = document.getElementById("profile-icon");
  const dropdown = document.getElementById("dropdown");

  db.ref("users/" + user.uid + "/profileImage").once("value").then(snapshot => {
    const image = snapshot.val();
    icon.innerHTML = "";

    if (image) {
      const img = document.createElement("img");
      img.src = image;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.borderRadius = "50%";
      icon.appendChild(img);
    } else {
      icon.textContent = user.email[0].toUpperCase();
    }

    icon.title = user.email;
  });

  icon.onclick = () => dropdown.classList.toggle("hidden");
});

window.logout = () => auth.signOut().then(() => window.location.href = "index.html");
window.viewProfile = () => window.location.href = "profile.html";

document.addEventListener("click", (e) => {
  const wrapper = document.getElementById("profile-wrapper");
  if (!wrapper.contains(e.target)) {
    document.getElementById("dropdown").classList.add("hidden");
  }
});

// Game variables
let board = [];
let minePositions = new Set();
let revealedTiles = new Set();
let gameStarted = false;
let baseBet = 0;
let autoRunning = false;

function resetBoard() {
  gridEl.innerHTML = "";
  board = [];
  minePositions.clear();
  revealedTiles.clear();
  profitDisplay.textContent = "0.00";
  gameStarted = false;

  for (let i = 0; i < 25; i++) {
    const tile = document.createElement("div");
    tile.classList.add("tile");
    tile.dataset.index = i;
    tile.addEventListener("click", onTileClick);
    gridEl.appendChild(tile);
    board.push(tile);
  }
}

function placeMines(count) {
  minePositions.clear();
  while (minePositions.size < count) {
    const rand = Math.floor(Math.random() * 25);
    minePositions.add(rand);
  }
}

function onTileClick(e) {
  if (!gameStarted) return;

  const index = parseInt(e.target.dataset.index);
  if (revealedTiles.has(index)) return;

  if (minePositions.has(index)) {
    e.target.textContent = "💣";
    e.target.style.backgroundColor = "#cc3333";
    revealAll();
    cashOutBtn.disabled = true;
    playBtn.disabled = false;
    gameStarted = false;
  } else {
    revealedTiles.add(index);
    e.target.textContent = "💎";
    e.target.style.backgroundColor = "#00cc66";
    e.target.classList.add("revealed");
    updateProfit();
  }
}

function revealAll() {
  for (let i = 0; i < board.length; i++) {
    if (minePositions.has(i)) {
      board[i].textContent = "💣";
      board[i].style.backgroundColor = "#cc3333";
    }
  }
}

function updateProfit() {
  const gems = revealedTiles.size;
  if (gems === 0) {
    profitDisplay.textContent = "0.00";
    return;
  }

  const mines = Math.max(1, Math.min(24, parseInt(mineCountInput.value)));
  const safeTiles = 25 - mines;
  const multiplier = safeTiles / (safeTiles - gems);
  const profit = (baseBet * multiplier).toFixed(2);
  profitDisplay.textContent = profit;
}

// Manual Play
playBtn.addEventListener("click", () => {
  let mines = parseInt(mineCountInput.value);
  if (mines > 24) mines = 24;
  if (mines < 1 || isNaN(mines)) mines = 1;
  mineCountInput.value = mines;

  const bet = parseFloat(betInput.value);
  if (isNaN(bet) || bet <= 0) {
    alert("Enter a valid bet amount.");
    return;
  }

  if (balance < bet) {
    alert("Insufficient balance.");
    return;
  }

  baseBet = bet;
  setBalance(balance - bet);

  resetBoard();
  placeMines(mines);
  gameStarted = true;
  playBtn.disabled = true;
  cashOutBtn.disabled = false;
});


cashOutBtn.addEventListener("click", () => {
  if (!gameStarted) return;

  const profit = parseFloat(profitDisplay.textContent);
  setBalance(balance + profit);

  gameStarted = false;
  playBtn.disabled = false;
  cashOutBtn.disabled = true;
  revealAll();
});


// Manual / Auto Toggle
manualBtn.addEventListener("click", () => {
  manualBtn.classList.add("active");
  autoBtn.classList.remove("active");
  manualControls.classList.remove("hidden");
  autoControls.classList.add("hidden");
});

autoBtn.addEventListener("click", () => {
  autoBtn.classList.add("active");
  manualBtn.classList.remove("active");
  autoControls.classList.remove("hidden");
  manualControls.classList.add("hidden");
});

// Auto Play Logic
startAutoBtn.addEventListener("click", () => {
  let bet = parseFloat(autoBet.value);
  let mines = parseInt(autoMineCount.value);
  let plays = parseInt(autoPlays.value);

  if (isNaN(bet) || bet <= 0 || isNaN(mines) || isNaN(plays) || plays <= 0) {
    alert("Please enter valid auto play settings.");
    return;
  }

  if (mines > 24) mines = 24;
  if (mines < 1) mines = 1;
  autoMineCount.value = mines;

  autoRunning = true;
  startAutoBtn.disabled = true;
  stopAutoBtn.disabled = false;

  let playCount = 0;

  const autoPlay = () => {
    if (!autoRunning || playCount >= plays) {
      autoRunning = false;
      startAutoBtn.disabled = false;
      stopAutoBtn.disabled = true;
      return;
    }

    resetBoard();
    placeMines(mines);
    baseBet = bet;
    gameStarted = true;
    playCount++;

    // Click a random tile
    const indices = [...Array(25).keys()].filter(i => !revealedTiles.has(i));
    const randTile = indices[Math.floor(Math.random() * indices.length)];
    board[randTile].click();

    // Wait and continue
    setTimeout(autoPlay, 1000);
  };

  autoPlay();
});

stopAutoBtn.addEventListener("click", () => {
  autoRunning = false;
  startAutoBtn.disabled = false;
  stopAutoBtn.disabled = true;
});
