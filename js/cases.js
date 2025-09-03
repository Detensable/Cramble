// cases.js - Cases Game with Firebase Realtime DB (v8.10.1)

(() => {
  // DOM Elements
  const balanceEl = document.getElementById('balance');
  const balanceDisplayEl = document.getElementById('balance-display');
  const betInput = document.getElementById('bet');
  const difficultySelect = document.getElementById('difficulty');
  const crackBtn = document.getElementById('crackBtn');
  const reelStrip = document.getElementById('reelStrip');
  const autoRoundsInput = document.getElementById('autoRounds');
  const startAutoBtn = document.getElementById('startAutoBtn');
  const stopAutoBtn = document.getElementById('stopAutoBtn');
  const statusMessage = document.getElementById('statusMessage');

  let TILE_WIDTH = 110;
  let tiles = [];
  let isSpinning = false;
  let autoplayRoundsLeft = 0;
  let isAutoPlaying = false;
  let currentUser = null;
  let userBalance = 0; // fallback

  // Multiplier sets per difficulty
  const difficulties = {
    easy: [
      {m: 23,   chance: 0.004, icon: '💎', className: 'multiplier-23x'},
      {m: 10,   chance: 0.008, icon: '🎯', className: 'multiplier-10x'},
      {m: 3,    chance: 0.035, icon: '🍀', className: 'multiplier-3x'},
      {m: 2,    chance: 0.06,  icon: '⭐', className: 'multiplier-2x'},
      {m: 1.09, chance: 0.393, icon: '✨', className: 'multiplier-1_09x'},
      {m: 0.4,  chance: 0.33,  icon: '🍂', className: 'multiplier-0_4x'},
      {m: 0.1,  chance: 0.17,  icon: '💀', className: 'multiplier-0_1x'},
    ],
    medium: [
      {m:115, chance:0.001, icon:'💎', className:'multiplier-115x'},
      {m:41, chance:0.0015, icon:'🎯', className:'multiplier-41x'},
      {m:15, chance:0.004, icon:'🍀', className:'multiplier-15x'},
      {m:10, chance:0.0085, icon:'⭐', className:'multiplier-10x'},
      {m:7.5, chance:0.015, icon:'✨', className:'multiplier-7_5x'},
      {m:3.5, chance:0.03, icon:'🍂', className:'multiplier-3_5x'},
      {m:2, chance:0.06, icon:'🔥', className:'multiplier-2x'},
      {m:1.5, chance:0.13, icon:'🌟', className:'multiplier-1_5x'},
      {m:0.4, chance:0.18, icon:'❄️', className:'multiplier-0_4x'},
      {m:0.2, chance:0.27, icon:'💧', className:'multiplier-0_2x'},
      {m:0, chance:0.30, icon:'⚫', className:'multiplier-0x'},
    ],
    hard: [
      {m:1000, chance:0.00005, icon:'💎', className:'multiplier-1000x'},
      {m:495, chance:0.0001, icon:'🎯', className:'multiplier-495x'},
      {m:250, chance:0.00015, icon:'🍀', className:'multiplier-250x'},
      {m:100, chance:0.0003, icon:'⭐', className:'multiplier-100x'},
      {m:50, chance:0.0004, icon:'✨', className:'multiplier-50x'},
      {m:35, chance:0.002, icon:'🔥', className:'multiplier-35x'},
      {m:15, chance:0.003, icon:'🌟', className:'multiplier-15x'},
      {m:10, chance:0.004, icon:'⚡', className:'multiplier-10x'},
      {m:8, chance:0.02, icon:'🌪️', className:'multiplier-8x'},
      {m:3, chance:0.05, icon:'🍁', className:'multiplier-3x'},
      {m:1.5, chance:0.10, icon:'❄️', className:'multiplier-1_5x'},
      {m:0.8, chance:0.10, icon:'💧', className:'multiplier-0_8x'},
      {m:0.4, chance:0.12, icon:'🌀', className:'multiplier-0_4x'},
      {m:0.2, chance:0.25, icon:'⚫', className:'multiplier-0_2x'},
      {m:0, chance:0.35, icon:'💀', className:'multiplier-0x_hard'},
    ],
    expert: [
      {m:10000, chance:0.000002, icon:'💎', className:'multiplier-10000x'},
      {m:3500, chance:0.000006, icon:'🎯', className:'multiplier-3500x'},
      {m:1500, chance:0.000012, icon:'🍀', className:'multiplier-1500x'},
      {m:850, chance:0.00030, icon:'⭐', className:'multiplier-850x'},
      {m:460, chance:0.00005, icon:'✨', className:'multiplier-460x'},
      {m:250, chance:0.0001, icon:'🔥', className:'multiplier-250x'},
      {m:100, chance:0.0002, icon:'🌟', className:'multiplier-100x'},
      {m:75, chance:0.0003, icon:'⚡', className:'multiplier-75x'},
      {m:50, chance:0.0004, icon:'🌪️', className:'multiplier-50x'},
      {m:20, chance:0.002, icon:'🍁', className:'multiplier-20x'},
      {m:15, chance:0.005, icon:'❄️', className:'multiplier-15x'},
      {m:10, chance:0.008, icon:'💧', className:'multiplier-10x'},
      {m:7, chance:0.02, icon:'🌀', className:'multiplier-7x'},
      {m:5, chance:0.03, icon:'⚫', className:'multiplier-5x'},
      {m:1.5, chance:0.08, icon:'💀', className:'multiplier-1_5x'},
      {m:0.7, chance:0.15, icon:'🍂', className:'multiplier-0_7x'},
      {m:0.3, chance:0.15, icon:'🌑', className:'multiplier-0_3x'},
      {m:0.15, chance:0.20, icon:'🌘', className:'multiplier-0_15x'},
      {m:0, chance:0.3539, icon:'⚫', className:'multiplier-0x_expert'},
    ]
  };

  let currentDifficulty = difficultySelect.value;
  let multipliers = difficulties[currentDifficulty];

  // Update balance display (UI only)
  function updateBalanceLocally(amount) {
    userBalance = Math.max(0, userBalance + amount);
    if (balanceEl) balanceEl.textContent = userBalance.toFixed(2);
    if (balanceDisplayEl) balanceDisplayEl.textContent = `Balance: $${userBalance.toFixed(2)}`;
  }

  // Update balance in Firebase Realtime DB
  async function updateBalance(delta) {
    if (!currentUser) return;

    const userRef = firebase.database().ref("users/" + currentUser.uid + "/points");
    try {
      await userRef.transaction(current => (current || 0) + delta);
    } catch (err) {
      console.error("Balance update failed:", err);
      alert("Transaction failed. Please try again.");
    }
  }

  // Pick a random multiplier based on chance
  function pickMultiplier() {
    const rand = Math.random();
    let sum = 0;
    for (const m of multipliers) {
      sum += m.chance;
      if (rand < sum) return m;
    }
    return multipliers[multipliers.length - 1];
  }

  // Create a tile element
  function createTile(multiplier) {
    const div = document.createElement('div');
    div.classList.add('case-tile', multiplier.className);
    div.innerHTML = `<div class="case-icon">${multiplier.icon}</div>${multiplier.m}x`;
    div.dataset.multiplier = multiplier.m;
    return div;
  }

  // Measure actual tile width (including margins)
  function measureTileWidth() {
    const exampleTile = document.querySelector('.case-tile');
    if (exampleTile) {
      const style = getComputedStyle(exampleTile);
      const width = exampleTile.offsetWidth + parseFloat(style.marginLeft) + parseFloat(style.marginRight);
      TILE_WIDTH = Math.round(width);
    }
  }

  // Initialize the reel with 500 random tiles
  function initializeReel() {
    if (reelStrip.children.length === 0) {
      tiles = [];
      for (let i = 0; i < 500; i++) {
        const multiplier = pickMultiplier();
        const tile = createTile(multiplier);
        reelStrip.appendChild(tile);
        tiles.push(tile);
      }
      reelStrip.style.transition = 'none';
      reelStrip.style.transform = 'translateX(0)';
    }
  }

  // Spin the reel
  function spinReel() {
    if (isSpinning) return;

    const bet = parseFloat(betInput.value);
    if (isNaN(bet) || bet <= 0) {
      statusMessage.textContent = "Please enter a valid bet.";
      return;
    }
    if (bet > userBalance) {
      statusMessage.textContent = "Insufficient balance!";
      return;
    }

    isSpinning = true;
    crackBtn.disabled = true;
    startAutoBtn.disabled = true;
    statusMessage.textContent = 'Cracking...';

    // Deduct bet
    updateBalance(-bet);
    updateBalanceLocally(-bet);

    // Pick winning multiplier
    const winningMultiplier = pickMultiplier();

    const totalTiles = 500;
    const minSpinDistance = 50;
    const maxSpinDistance = 100;
    const landingIndex = Math.floor(minSpinDistance + Math.random() * (maxSpinDistance - minSpinDistance));

    const reelContainer = document.querySelector('.case-reel');
    const containerWidth = reelContainer.offsetWidth;
    const targetPosition = -(landingIndex * TILE_WIDTH) + (containerWidth - TILE_WIDTH) / 2;

    // Dramatic spin effect
    const baseOffset = 2500;
    const randomExtra = Math.random() * 1500;
    const startPosition = targetPosition + baseOffset + randomExtra;
    const spinDuration = 2500;

    // Reset position (no transition)
    reelStrip.style.transition = 'none';
    reelStrip.style.transform = `translateX(${startPosition}px)`;
    void reelStrip.offsetWidth; // force reflow

    // Rebuild tiles with winning one at landingIndex
    tiles = [];
    reelStrip.innerHTML = '';

    for (let i = 0; i < totalTiles; i++) {
      const multiplier = (i === landingIndex) ? winningMultiplier : pickMultiplier();
      const tile = createTile(multiplier);
      reelStrip.appendChild(tile);
      tiles.push(tile);
    }

    // Animate to final position
    reelStrip.style.transition = `transform ${spinDuration}ms cubic-bezier(0.33, 1, 0.68, 1)`;
    reelStrip.style.transform = `translateX(${Math.round(targetPosition)}px)`;

    // After animation ends
    setTimeout(() => {
      const arrow = document.querySelector('.arrow-down');
      const arrowRect = arrow.getBoundingClientRect();
      const reelRect = reelContainer.getBoundingClientRect();
      const transform = getComputedStyle(reelStrip).transform;
      let translateX = 0;
      if (transform && transform !== 'none') {
        const matrix = new DOMMatrixReadOnly(transform);
        translateX = matrix.m41;
      }

      const arrowCenterX = arrowRect.left + arrowRect.width / 2;
      const relativeX = arrowCenterX - reelRect.left;
      const tileIndex = Math.floor((relativeX - translateX - TILE_WIDTH / 2) / TILE_WIDTH);
      const landedTile = tiles[tileIndex];

      if (!landedTile) {
        statusMessage.textContent = "Error: Could not read result.";
        isSpinning = false;
        return;
      }

      const multiplierValue = parseFloat(landedTile.dataset.multiplier);
      const winnings = bet * multiplierValue;

      // Add winnings
      if (winnings > 0) {
        updateBalance(winnings);
        updateBalanceLocally(winnings);
      }

      // Show result
      if (multiplierValue >= 10) {
        statusMessage.innerHTML = `🎉 <strong>MASSIVE WIN: ${multiplierValue}x!</strong> +$${winnings.toFixed(2)}!`;
      } else if (multiplierValue > 1) {
        statusMessage.innerHTML = `✨ <strong>${multiplierValue}x!</strong> You won $${winnings.toFixed(2)}.`;
      } else {
        statusMessage.textContent = `Result: ${multiplierValue}x. You lost.`;
      }

      isSpinning = false;
      crackBtn.disabled = false;
      startAutoBtn.disabled = false;

      if (isAutoPlaying) {
        autoplayRoundsLeft--;
        if (autoplayRoundsLeft <= 0) {
          stopAutoPlay();
        } else {
          setTimeout(spinReel, 500);
        }
      }
    }, spinDuration + 100);
  }

  // Auto Play Functions
  function startAutoPlay() {
    if (isSpinning) return;
    const rounds = parseInt(autoRoundsInput.value);
    if (isNaN(rounds) || rounds <= 0) {
      statusMessage.textContent = "Enter a valid number of rounds.";
      return;
    }
    autoplayRoundsLeft = rounds;
    isAutoPlaying = true;
    crackBtn.disabled = true;
    startAutoBtn.disabled = true;
    stopAutoBtn.disabled = false;
    statusMessage.textContent = `Auto play: ${rounds} rounds`;
    spinReel();
  }

  function stopAutoPlay() {
    isAutoPlaying = false;
    autoplayRoundsLeft = 0;
    crackBtn.disabled = false;
    startAutoBtn.disabled = false;
    stopAutoBtn.disabled = true;
    statusMessage.textContent = 'Auto play stopped.';
  }

  // Difficulty change
  difficultySelect.addEventListener('change', () => {
    currentDifficulty = difficultySelect.value;
    multipliers = difficulties[currentDifficulty];
    reelStrip.innerHTML = '';
    initializeReel();
  });

  // Button Listeners
  crackBtn.addEventListener('click', spinReel);
  startAutoBtn.addEventListener('click', startAutoPlay);
  stopAutoBtn.addEventListener('click', stopAutoPlay);

  // Firebase Auth & Balance Sync
  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }

    currentUser = user;

    // Load profile image
    const profileIcon = document.getElementById('profile-icon');
    const dropdown = document.getElementById('dropdown');
    const profileImageRef = firebase.database().ref("users/" + user.uid + "/profileImage");
    const snapshot = await profileImageRef.once("value");
    const imgUrl = snapshot.val();

    profileIcon.innerHTML = "";
    if (imgUrl) {
      const img = document.createElement("img");
      img.src = imgUrl;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.borderRadius = "50%";
      img.style.objectFit = "cover";
      profileIcon.appendChild(img);
    } else {
      profileIcon.textContent = user.email?.[0].toUpperCase() || "U";
    }

    profileIcon.onclick = () => dropdown.classList.toggle("hidden");
    document.addEventListener("click", (e) => {
      if (!profileIcon.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add("hidden");
      }
    });

    // Listen to balance
    const balanceRef = firebase.database().ref("users/" + user.uid + "/points");
    balanceRef.on("value", (snapshot) => {
      const points = snapshot.val();
      userBalance = points || 0;
      if (balanceEl) balanceEl.textContent = userBalance.toFixed(2);
      if (balanceDisplayEl) balanceDisplayEl.textContent = `Balance: $${userBalance.toFixed(2)}`;
    });
  });

  // Initialize Game
  initializeReel();
  measureTileWidth();

})();