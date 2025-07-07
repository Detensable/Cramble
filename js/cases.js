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
  const TILE_WIDTH = 110;

  let tiles = [];          // <--- HERE: declare this once for all functions
  let balance = 1000;
  let isSpinning = false;
  let autoplayRoundsLeft = 0;
  let isAutoPlaying = false;
  let currentPosition = 0;
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
 let currentDifficulty = difficultySelect.value;
  let multipliers = difficulties[currentDifficulty];

  function updateBalance(amount) {
    balance = Math.max(0, balance + amount);
    balanceEl.textContent = balance.toFixed(2);
  }

  function pickMultiplier() {
    const rand = Math.random();
    let sum = 0;
    for (const m of multipliers) {
      sum += m.chance;
      if (rand < sum) return m;
    }
    return multipliers[multipliers.length - 1];
  }

  function createTile(multiplier) {
    const div = document.createElement('div');
    div.classList.add('case-tile', multiplier.className);
    div.innerHTML = `<div class="case-icon">${multiplier.icon}</div>${multiplier.m}x`;
    div.dataset.multiplier = multiplier.m;
    return div;
  }

  function initializeReel() {
    if (reelStrip.children.length === 0) {
      tiles = [];
      currentPosition = 0;
      const initialPattern = [];
      for (let i = 0; i < 500; i++) {
        initialPattern.push(pickMultiplier());
      }
      initialPattern.forEach(multiplier => {
        const tile = createTile(multiplier);
        reelStrip.appendChild(tile);
        tiles.push(tile);
      });
      reelStrip.style.transition = 'none';
      reelStrip.style.transform = `translateX(${currentPosition}px)`;
    }
  }

function spinReel() {
  if (isSpinning) return; // Prevent multiple concurrent spins

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

  // Pick the multiplier randomly for the current spin
  const winningMultiplier = pickMultiplier();

  const totalTiles = 500; // number of tiles in the reel
  const minSpinDistance = 50;
  
  // Pick a random spot between 51 and 100 where the spin will land
  const landingIndex = Math.floor(minSpinDistance + Math.random() * (100 - minSpinDistance));

  currentPosition = 0;
  reelStrip.style.transition = 'none';
  reelStrip.style.transform = `translateX(${currentPosition}px)`;
  void reelStrip.offsetWidth; // force reflow to apply styles

  // Clear old tiles and reset array
  tiles = [];
  reelStrip.innerHTML = '';

  // Populate tiles with random multipliers, ensuring the winning multiplier lands on the chosen index
  for (let i = 0; i < totalTiles; i++) {
    const multiplier = (i === landingIndex) ? winningMultiplier : pickMultiplier();
    const tile = createTile(multiplier);
    reelStrip.appendChild(tile);
    tiles.push(tile);
  }

  const containerWidth = reelStrip.parentElement.clientWidth;
  const targetPosition = -landingIndex * TILE_WIDTH + (containerWidth / 2) - (TILE_WIDTH / 2);

  reelStrip.style.transition = 'transform 3s cubic-bezier(0.33, 1, 0.68, 1)';
  reelStrip.style.transform = `translateX(${targetPosition}px)`;

  setTimeout(() => {
    currentPosition = targetPosition;
    reelStrip.style.transition = 'none';

    const tileIndexUnderArrow = Math.round(-currentPosition / TILE_WIDTH);
    const landedTile = tiles[tileIndexUnderArrow];
    let multiplierValue = landedTile ? parseFloat(landedTile.dataset.multiplier) : winningMultiplier.m;
    if (isNaN(multiplierValue)) multiplierValue = winningMultiplier.m;

    const winnings = bet * multiplierValue;
    updateBalance(winnings);

    statusMessage.textContent = `Result: ${multiplierValue}x! You won ${winnings.toFixed(2)} credits.`;

    crackBtn.disabled = false;
    startAutoBtn.disabled = false;
    isSpinning = false;

    if (isAutoPlaying) {
      autoplayRoundsLeft--;
      if (autoplayRoundsLeft <= 0) {
        stopAutoPlay();
      } else {
        setTimeout(spinReel, 1000);
      }
      updateStatus();
    }
  }, 3100);
}

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

  difficultySelect.addEventListener('change', () => {
    currentDifficulty = difficultySelect.value;
    multipliers = difficulties[currentDifficulty];
    reelStrip.innerHTML = '';
    initializeReel();
  });

  crackBtn.addEventListener('click', spinReel);
  startAutoBtn.addEventListener('click', startAutoPlay);
  stopAutoBtn.addEventListener('click', stopAutoPlay);

  // Initialize
  updateBalance(0);
  initializeReel();
})();