  console.clear();

  // === Firebase References ===
  const auth = firebase.auth();
  const db = firebase.database();

  let currentUser = null;
  let balance = 0;

  // DOM Elements
  const ballsEl = document.getElementById("balls");
  const multiplierEl = document.getElementById("multiplier");
  const dropButton = document.getElementById("drop-button");
  const autoDropCheckbox = document.getElementById("checkbox");
  const betAmountInput = document.getElementById("bet-amount");
  const btnHalf = document.getElementById("btn-half");
  const btnDouble = document.getElementById("btn-double");
  const onWinSelect = document.getElementById("on-win");
  const payoutsContainer = document.getElementById("payouts");

  // Update balance display
  function updateBalanceDisplay() {
    ballsEl.textContent = balance.toFixed(2);
  }

  // Save balance to Firebase
  function saveBalance(newBalance) {
    if (!currentUser) return;
    balance = parseFloat(newBalance.toFixed(2));
    db.ref("users/" + currentUser.uid).update({ points: balance });
    updateBalanceDisplay();
  }

  // Load balance from Firebase
  function loadBalance() {
    if (!currentUser) return;
    const ref = db.ref("users/" + currentUser.uid + "/points");
    ref.once("value").then(snapshot => {
      const points = snapshot.val();
      balance = typeof points === 'number' ? points : 10.0; // default 10.0
      updateBalanceDisplay();
    }).catch(err => {
      console.error("Failed to load balance:", err);
      balance = 10.0;
      updateBalanceDisplay();
    });
  }

// === Auth State Listener ===
auth.onAuthStateChanged(user => {
  if (!user) {
    return window.location.href = "home.html";
  }

  currentUser = user;
  loadBalance(); // Load balance once logged in
  dropButton.disabled = false;
  dropButton.textContent = "DROP";

  // === Setup Profile Display (Base64 Image + "View Profile") ===
  const profileIcon = document.getElementById("profile-icon");
  const userDisplay = document.getElementById("user-display");

  // Always show "View Profile" in dropdown
  userDisplay.textContent = "View Profile";

  // Clear previous content
  profileIcon.innerHTML = "";

  const displayName = user.displayName || user.email || "Player";

  // Load profileImage from Realtime DB
  db.ref("users/" + user.uid + "/profileImage").once("value").then(snapshot => {
    const base64Image = snapshot.val();

    if (base64Image && typeof base64Image === 'string') {
      // Create image element
      const img = document.createElement("img");
      
      // If it's a raw Base64 string (without prefix), add the data URL header
      if (!base64Image.startsWith("data:image")) {
        img.src = "data:image/png;base64," + base64Image;
      } else {
        img.src = base64Image; // Already has prefix
      }

      img.style.width = "100%";
      img.style.height = "100%";
      img.style.borderRadius = "50%";
      img.style.objectFit = "cover";

      // Fallback if image fails (e.g., invalid Base64)
      img.onerror = () => {
        console.error("Failed to load Base64 image");
        profileIcon.textContent = displayName[0].toUpperCase();
      };

      profileIcon.appendChild(img);
    } else {
      // No image set — show first letter
      profileIcon.textContent = displayName[0].toUpperCase();
    }
  }).catch(err => {
    console.warn("Failed to load profileImage from Firebase:", err);
    profileIcon.textContent = displayName[0].toUpperCase();
  });
});

  // === Game Logic Below (Unchanged except balance sync) ===
  const width = 620;
  const height = 534;
  let lastMultiplier = 1.0;
  let currentBet = 1.0;
  let autoDropEnabled = false;
  let autoDroppingInterval = null;

  const multipliers = [50, 20, 7, 4, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 4, 7, 20, 50];
  const notes = [
    "C#5", "C5", "B5", "A#5", "A5", "G#4", "G4", "F#4", "F4", "F#4", "G4", "G#4", "A5", "A#5", "B5", "C5", "C#5"
  ];

  // Generate payout labels
  multipliers.forEach((m, i) => {
    const note = document.createElement("div");
    note.className = "note";
    note.id = `note-${i}`;
    note.textContent = m >= 10 ? m : m.toFixed(1);
    payoutsContainer.appendChild(note);
  });

  // Tone.js
  const clickSynth = new Tone.NoiseSynth({ volume: -26 }).toDestination();
  const winSynth = new Tone.Synth({ oscillator: { type: "sine" } }).toDestination();

  class NotePlayer {
    constructor(note) {
      this.synth = new Tone.PolySynth().toDestination();
      this.synth.set({ volume: -6 });
      this.note = note;
    }
    play() {
      this.synth.triggerAttackRelease(this.note, "32n");
    }
  }

  const notePlayers = notes.map(n => new NotePlayer(n));

  // Matter.js
  const { Engine, Render, Runner, Bodies, Composite, Events } = Matter;

  const engine = Engine.create({
    gravity: { scale: 0.0007 }
  });

  const canvas = document.getElementById("canvas");
  const render = Render.create({
    canvas,
    engine,
    options: {
      width,
      height,
      wireframes: false,
      background: 'transparent'
    }
  });

  // Pegs
  const GAP = 32;
  const PEG_RAD = 4;
  const pegs = [];
  for (let r = 0; r < 16; r++) {
    const cols = r + 3;
    for (let c = 0; c < cols; c++) {
      const x = width / 2 + (c - (cols - 1) / 2) * GAP;
      const y = GAP + r * GAP;
      const peg = Bodies.circle(x, y, PEG_RAD, {
        isStatic: true,
        label: "Peg",
        render: { fillStyle: "#fff" }
      });
      pegs.push(peg);
    }
  }
  Composite.add(engine.world, pegs);

  // Ground
  const ground = Bodies.rectangle(width / 2, height + 22, width * 2, 40, {
    isStatic: true,
    label: "Ground"
  });
  Composite.add(engine.world, [ground]);

  // Ball
  const BALL_RAD = 7;
function dropABall() {
  if (!currentUser) return;

  if (balance < currentBet) {
    alert("Insufficient balance! Auto Bet stopped.");
    // Stop auto-dropping
    autoDropEnabled = false;
    autoDropCheckbox.checked = false;
    if (autoDroppingInterval) {
      clearInterval(autoDroppingInterval);
      autoDroppingInterval = null;
    }
    dropButton.textContent = "DROP";
    return;
  }

  // Deduct bet
  saveBalance(balance - currentBet);

  const x = Math.random() * (GAP * 2) + (width / 2 - GAP);
  const ball = Bodies.circle(x, -PEG_RAD, BALL_RAD, {
    label: "Ball",
    restitution: 0.6,
    render: { fillStyle: "#f23" }
  });

  clickSynth.triggerAttackRelease("32n");
  Composite.add(engine.world, ball);
}
  // Collision
  Events.on(engine, "collisionStart", (event) => {
    event.pairs.forEach(pair => {
      const { bodyA, bodyB } = pair;
      let ball, other;

      if (bodyA.label === "Ball" && bodyB.label === "Ground") {
        ball = bodyA;
        other = bodyB;
      } else if (bodyB.label === "Ball" && bodyA.label === "Ground") {
        ball = bodyB;
        other = bodyA;
      }

      if (ball && other) {
        Composite.remove(engine.world, ball);
        const index = Math.floor((ball.position.x - width / 2) / GAP + 17 / 2);
        if (index >= 0 && index < 17) {
          const multiplier = multipliers[index];
          const winAmount = currentBet * multiplier;
          const newBalance = balance + winAmount;

          saveBalance(newBalance);
          lastMultiplier = multiplier;

          if (multiplier > 1) {
            winSynth.triggerAttackRelease("C5", "8n");
          }

          const el = document.getElementById(`note-${index}`);
          el.dataset.pressed = "true";
          setTimeout(() => el.dataset.pressed = "false", 500);

          updateBalanceDisplay();
        }
      }
    });
  });

  // Run engine
  Render.run(render);
  const runner = Runner.create();
  Runner.run(runner, engine);

  // === UI Controls ===
  function updateUI() {
    updateBalanceDisplay();
    multiplierEl.textContent = lastMultiplier.toFixed(2) + 'x';
    betAmountInput.value = currentBet.toFixed(2);
  }

  dropButton.addEventListener("click", () => {
    if (!currentUser) return;

    if (autoDropEnabled && autoDroppingInterval) {
      clearInterval(autoDroppingInterval);
      autoDroppingInterval = null;
      dropButton.textContent = "DROP";
    } else if (autoDropEnabled && !autoDroppingInterval) {
      dropABall();
      autoDroppingInterval = setInterval(dropABall, 600);
      dropButton.textContent = "STOP";
    } else {
      dropABall();
    }
    updateUI();
  });

  autoDropCheckbox.addEventListener("change", () => {
    autoDropEnabled = autoDropCheckbox.checked;
    onWinSelect.disabled = !autoDropEnabled;
    if (!autoDropEnabled && autoDroppingInterval) {
      clearInterval(autoDroppingInterval);
      autoDroppingInterval = null;
      dropButton.textContent = "DROP";
    }
  });

  btnHalf.addEventListener("click", () => {
    currentBet = Math.max(0.01, currentBet / 2);
    updateUI();
  });

  btnDouble.addEventListener("click", () => {
    currentBet *= 2;
    updateUI();
  });

  betAmountInput.addEventListener("change", () => {
    currentBet = parseFloat(betAmountInput.value) || 1.0;
    updateUI();
  });

  // Profile Dropdown Toggle
  document.getElementById("profile-icon").addEventListener("click", () => {
    document.getElementById("dropdown").classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    const wrapper = document.getElementById("profile-wrapper");
    if (!wrapper?.contains(e.target)) {
      document.getElementById("dropdown")?.classList.add("hidden");
    }
  });

  // Logout
  document.getElementById("sign-out").addEventListener("click", () => {
    auth.signOut().then(() => {
      window.location.href = "home.html";
    });
  });

  // Initial UI
  updateUI();