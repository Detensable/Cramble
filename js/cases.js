(() => {
  const balanceEl = document.getElementById('balance');
  const betInput = document.getElementById('bet');
  const difficultySelect = document.getElementById('difficulty');
  const crackBtn = document.getElementById('crackBtn');
  const reelStrip = document.getElementById('reelStrip');
  const autoRoundsInput = document.getElementById('autoRounds');
  const startAutoBtn = document.getElementById('startAutoBtn');
  const stopAutoBtn = document.getElementById('stopAutoBtn');
  const statusMessage = document.getElementById('statusMessage');

  let balance = 1000;
  let isSpinning = false;
  let autoplayRoundsLeft = 0;
  let isAutoPlaying = false;

  // Full multiplier sets per difficulty
  const difficulties = {
    easy: [
      {m:23, chance:0.01, icon:'💎', className:'multiplier-23x'},
      {m:10, chance:0.02, icon:'🎯', className:'multiplier-10x'},
      {m:3, chance:0.04, icon:'🍀', className:'multiplier-3x'},
      {m:2, chance:0.07, icon:'⭐', className:'multiplier-2x'},
      {m:1.09, chance:0.10, icon:'✨', className:'multiplier-1_09x'},
      {m:0.4, chance:0.35, icon:'🍂', className:'multiplier-0_4x'},
      {m:0.1, chance:0.41, icon:'💀', className:'multiplier-0_1x'},
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
    window.updateBalance = function(amount) {
  balance = Math.max(0, balance + amount);
  balanceEl.textContent = balance.toFixed(2);
};
    function createWeightedArray(items) {
    const arr = [];
    items.forEach((item, idx) => {
      const count = Math.floor(item.chance * 100000);
      for (let i = 0; i < count; i++) arr.push(idx);
    });
    return arr;
  }

  const weightedArrays = {};
  for (const level in difficulties) {
    weightedArrays[level] = createWeightedArray(difficulties[level]);
  }

  let currentDifficulty = difficultySelect.value;
  let multipliers = difficulties[currentDifficulty];
  let weightedArray = weightedArrays[currentDifficulty];

  let tiles = [];
  let tileElements = [];
  let reelPosition = 0;

  function pickMultiplier() {
    const randomIndex = weightedArray[Math.floor(Math.random() * weightedArray.length)];
    return multipliers[randomIndex];
  }
function buildBaseTileSet(chosenTile) {
  const baseCount = 50;
  let baseTiles = [];

  // Fill with random tiles
  for (let i = 0; i < baseCount - 5; i++) {
    baseTiles.push(multipliers[Math.floor(Math.random() * multipliers.length)]);
  }
  // Insert chosen tiles
  for (let i = 0; i < 5; i++) {
    const index = Math.floor(Math.random() * baseTiles.length);
    baseTiles.splice(index, 0, chosenTile);
  }
  return baseTiles;
}

function appendTileSet(baseSet) {
  baseSet.forEach(tile => {
    const div = document.createElement('div');
    div.classList.add('case-tile', tile.className);
    div.innerHTML = `<div class="case-icon">${tile.icon}</div>${tile.m}x`;
    reelStrip.appendChild(div);
    tileElements.push(div);
    tiles.push(tile);
  });
}

async function spinReel() {
  if (isSpinning) return;

  const bet = parseFloat(betInput.value);
  if (isNaN(bet) || bet <= 0) {
    alert('Please enter a valid bet amount.');
    return;
  }
  if (bet > balance) {
    alert('Insufficient balance!');
    return;
  }

  isSpinning = true;
  crackBtn.disabled = true;
  startAutoBtn.disabled = true;
  updateBalance(-bet);
  statusMessage.textContent = 'Spinning...';

  const chosen = pickMultiplier();

  const tileWidth = 100;
  const visibleTiles = Math.ceil(reelStrip.parentElement.clientWidth / tileWidth);
  const bufferTiles = 20;
  const initialNeededTiles = visibleTiles + bufferTiles;

  // 1. If not enough tiles, add more at the end
  while (tileElements.length < initialNeededTiles) {
    appendTileSet(buildBaseTileSet(chosen));
  }

  // 2. Spin config
  let currentTranslateX = -reelPosition; // Start from where we left off
  const totalDistance = 8000;
  const minSpeed = 2;
  const maxSpeed = 50;
  const decelStart = totalDistance * 0.5;
  const decelEnd = totalDistance;

  function getSpeed(position) {
    if (position < decelStart) return maxSpeed;
    const progress = (position - decelStart) / (decelEnd - decelStart);
    return maxSpeed - (maxSpeed - minSpeed) * progress;
  }

  function spinStep() {
    const speed = getSpeed(currentTranslateX);
    currentTranslateX += speed;

    reelPosition = -currentTranslateX;
    reelStrip.style.transform = `translateX(${reelPosition}px)`;

    // 3. Generate new tiles if we're approaching end
    const reelRightEdge = Math.abs(reelPosition) + reelStrip.parentElement.clientWidth;
    const lastTileRightEdge = tileElements[tileElements.length - 1].offsetLeft + tileWidth;
    if (lastTileRightEdge - reelRightEdge < 400) {
      appendTileSet(buildBaseTileSet(chosen));
    }

    // 4. Cleanup old tiles off-screen (left side)
    while (tileElements.length > 0 && tileElements[0].offsetLeft + tileWidth < Math.abs(reelPosition) - 500) {
      const removed = tileElements.shift();
      removed.remove();
      tiles.shift();
    }

    if (currentTranslateX < totalDistance) {
      requestAnimationFrame(spinStep);
    } else {
      finalizeSpin(null, null, bet);
    }
  }

  requestAnimationFrame(spinStep);
}




function snapToChosenTile(chosen, bet) {
  // Find all tiles matching chosen multiplier
  const centerLine = reelStrip.parentElement.clientWidth / 2;

  const matchingTiles = tileElements
    .map((el, i) => ({i, el, tile: tiles[i]}))
    .filter(obj => obj.tile.m === chosen.m);

  if (matchingTiles.length === 0) {
    statusMessage.textContent = "Error: Chosen tile not found.";
    crackBtn.disabled = false;
    isSpinning = false;
    return;
  }

  // Pick the tile closest to center line
  let closestTile = null;
  let closestDist = Infinity;

  for (const obj of matchingTiles) {
    const tileCenterX = obj.el.offsetLeft + obj.el.offsetWidth / 2;
    const dist = Math.abs((tileCenterX + reelPosition) - centerLine);
    if (dist < closestDist) {
      closestDist = dist;
      closestTile = obj;
    }
  }

  // Calculate final translateX to center chosen tile
  const chosenTileCenterX = closestTile.el.offsetLeft + closestTile.el.offsetWidth / 2;
  const targetTranslateX = centerLine - chosenTileCenterX;

  // Animate snapping smoothly
  const start = reelPosition;
  const change = targetTranslateX - start;
  const duration = 1000;
  const startTime = performance.now();

  function animateSnap(timestamp) {
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 4);

    const currentPos = start + change * easeProgress;
    reelStrip.style.transform = `translateX(${currentPos}px)`;
    reelPosition = currentPos;

    if (progress < 1) {
      requestAnimationFrame(animateSnap);
    } else {
      // Finished snapping, update balance and buttons
      const winnings = bet * chosen.m;
      updateBalance(winnings);
      statusMessage.textContent = `Result: ${chosen.m}x multiplier! You won ${winnings.toFixed(2)} credits.`;

      crackBtn.disabled = false;
      startAutoBtn.disabled = false;
      isSpinning = false;
    }
  }
  requestAnimationFrame(animateSnap);
}


 function finalizeSpin(_, __, bet) {
  const centerLine = reelStrip.parentElement.clientWidth / 2;

  // Find the tile currently centered
  let closestTile = null;
  let closestDist = Infinity;

  tileElements.forEach((el, i) => {
    const tileCenter = el.offsetLeft + el.offsetWidth / 2;
    const dist = Math.abs(tileCenter + reelPosition - centerLine);
    if (dist < closestDist) {
      closestDist = dist;
      closestTile = { index: i, el, data: tiles[i] };
    }
  });

  const landed = closestTile.data;
  const winnings = bet * landed.m;

  updateBalance(winnings);
  statusMessage.textContent = `Result: ${landed.m}x multiplier! You won ${winnings.toFixed(2)} credits.`;

  crackBtn.disabled = false;
  startAutoBtn.disabled = false;
  isSpinning = false;

  if (isAutoPlaying) {
    autoplayRoundsLeft--;
    if (autoplayRoundsLeft <= 0) {
      stopAutoPlay();
    } else {
      setTimeout(() => crackBtn.click(), 1500);
    }
    updateStatus();
  }
}


  crackBtn.addEventListener('click', spinReel);

difficultySelect.addEventListener('change', () => {
  currentDifficulty = difficultySelect.value;
  multipliers = difficulties[currentDifficulty];
  weightedArray = weightedArrays[currentDifficulty];

  // Rebuild the reel tiles with a new chosen multiplier
  const chosen = pickMultiplier();
  tiles = [];
  tileElements = [];
  reelStrip.innerHTML = '';

  const baseSet = buildBaseTileSet(chosen);
  appendTileSet(baseSet);
});


  function updateStatus() {
    statusMessage.textContent = `Auto play rounds left: ${autoplayRoundsLeft}`;
  }

  function startAutoPlay() {
    if (isSpinning) return;
    const rounds = parseInt(autoRoundsInput.value);
    if (isNaN(rounds) || rounds <= 0) {
      alert('Please enter a valid number of auto rounds.');
      return;
    }
    autoplayRoundsLeft = rounds;
    isAutoPlaying = true;
    crackBtn.disabled = true;
    startAutoBtn.disabled = true;
    stopAutoBtn.disabled = false;
    updateStatus();
    crackBtn.click();
  }

  function stopAutoPlay() {
    isAutoPlaying = false;
    autoplayRoundsLeft = 0;
    crackBtn.disabled = false;
    startAutoBtn.disabled = false;
    stopAutoBtn.disabled = true;
    statusMessage.textContent = 'Auto play stopped.';
  }

  startAutoBtn.addEventListener('click', startAutoPlay);
  stopAutoBtn.addEventListener('click', stopAutoPlay);

  // Initial setup
  updateBalance(0);
})();