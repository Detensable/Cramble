const auth = firebase.auth();
const db = firebase.database();
let balance = 0;
let currentUser = null;
let betAmount = 0;
let currentRow = 0;
let currentMultiplier = 1;
let revealed = [];
let path = [];

const balanceDisplay = document.getElementById("balanceDisplay");
const tower = document.getElementById("tower");
const difficultySelect = document.getElementById("difficulty");
const startBtn = document.getElementById("startBtn");
const cashoutBtn = document.getElementById("cashoutBtn");
const multiplierDisplay = document.getElementById("multiplierDisplay");
const result = document.getElementById("result");

const difficulties = {
  easy:   { tiles: 4, bombs: 1, multipliers: [1, 1.31, 1.72, 2.26, 2.96, 3.87, 5.05, 6.60, 8.63] },
  medium: { tiles: 3, bombs: 1, multipliers: [1, 1.5, 2.25, 3.38, 5.07, 7.61, 11.42, 17.13, 25.7] },
  hard:   { tiles: 2, bombs: 1, multipliers: [1, 2, 4, 8, 16, 32, 64, 128, 256] },
  expert: { tiles: 3, bombs: 2, multipliers: [1, 3, 9, 27, 81, 243, 729, 2187, 6561] },
  master: { tiles: 4, bombs: 3, multipliers: [1, 4, 16, 64, 256, 1024, 4096, 16384] }
};

auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  console.log("User logged in:", user.email);
  currentUser = user;

  db.ref("users/" + user.uid + "/points").on("value", snapshot => {
    const val = snapshot.val();
    balance = val !== null ? val : 1000;
    console.log("Fetched balance:", balance);
    updateBalanceDisplay();
  });

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

document.addEventListener("click", e => {
  const wrapper = document.getElementById("profile-wrapper");
  if (!wrapper.contains(e.target)) {
    document.getElementById("dropdown").classList.add("hidden");
  }
});

function updateBalanceDisplay() {
  const value = balance.toFixed(2);
  console.log("Updating balance UI to:", value);
  if (balanceDisplay) balanceDisplay.textContent = value;
  if (currentUser) {
    db.ref("users/" + currentUser.uid + "/points").set(balance);
  }
}

function logout() {
  auth.signOut().then(() => {
    window.location.href = "index.html";
  });
}

function viewProfile() {
  window.location.href = "profile.html";
}

startBtn.addEventListener("click", startGame);
cashoutBtn.addEventListener("click", cashOut);

function startGame() {
  result.textContent = "";
  tower.innerHTML = "";
  currentRow = 0;
  revealed = [];
  path = [];
  currentMultiplier = 1;
  cashoutBtn.disabled = false;

  betAmount = parseFloat(document.getElementById("bet").value);
  if (isNaN(betAmount) || betAmount <= 0) {
    result.textContent = "Enter a valid bet.";
    return;
  }
  if (betAmount > balance) {
    result.textContent = "Insufficient balance.";
    return;
  }

  balance -= betAmount;
  updateBalanceDisplay();

  const diff = difficulties[difficultySelect.value];
  for (let i = 0; i < 9; i++) {
    const row = document.createElement("div");
    row.classList.add("row");

    const bombIndexes = new Set();
    while (bombIndexes.size < diff.bombs) {
      bombIndexes.add(Math.floor(Math.random() * diff.tiles));
    }

    const tiles = [];
    for (let j = 0; j < diff.tiles; j++) {
      const tile = document.createElement("div");
      tile.classList.add("tile");
      tile.dataset.bomb = bombIndexes.has(j) ? "1" : "0";
      tile.dataset.row = i;
      tile.dataset.index = j;
      tile.addEventListener("click", handleClick);
      tiles.push(tile);
      row.appendChild(tile);
    }

    path.unshift(tiles);
    tower.appendChild(row);
  }

  updateMultiplier();
}

function handleClick(e) {
  const tile = e.currentTarget;
  const row = parseInt(tile.dataset.row);
  if (row !== currentRow || tile.classList.contains("revealed")) return;

  revealRow(row);

  if (tile.dataset.bomb === "1") {
    tile.classList.add("bomb", "revealed");
    result.textContent = "💥 You hit a bomb!";
    cashoutBtn.disabled = true;
  } else {
    tile.classList.add("check", "revealed");
    currentRow++;
    updateMultiplier();

    if (currentRow >= 9) {
      result.textContent = `🎉 You reached the top! Total: ${currentMultiplier.toFixed(2)}×`;
      cashoutBtn.disabled = true;
      balance += betAmount * currentMultiplier;
      updateBalanceDisplay();
    }
  }
}

function cashOut() {
  result.textContent = `✅ Cashed out at ${currentMultiplier.toFixed(2)}×`;
  balance += betAmount * currentMultiplier;
  updateBalanceDisplay();
  cashoutBtn.disabled = true;
}

function revealRow(row) {
  const tiles = path[8 - row];
  tiles.forEach(tile => {
    tile.classList.add("revealed");
    tile.classList.add(tile.dataset.bomb === "1" ? "bomb" : "check");
    tile.removeEventListener("click", handleClick);
  });
}

function updateMultiplier() {
  const diff = difficulties[difficultySelect.value];
  currentMultiplier = diff.multipliers[Math.min(currentRow, 8)] || 1.0;
  multiplierDisplay.textContent = `Multiplier: ${currentMultiplier.toFixed(2)}×`;
}
