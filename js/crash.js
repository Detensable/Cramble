const auth = firebase.auth();
const db = firebase.database();

const multiplierDisplay = document.getElementById("multiplier");
const startBtn = document.getElementById("startBtn");
const cashOutBtn = document.getElementById("cashOutBtn");
const betInput = document.getElementById("betAmount");
const statusDisplay = document.getElementById("status");
const canvas = document.getElementById("crashCanvas");
const ctx = canvas.getContext("2d");

const autoToggle = document.getElementById("autoToggle");
const autoMultiplierInput = document.getElementById("autoMultiplier");

let multiplier = 1.0;
let crashed = false;
let cashOut = false;
let crashPoint = 0;
let animationFrame;
let userBalance = 0;
let currentUser;

auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "index.html";
  } else {
    currentUser = user;

    const icon = document.getElementById("profile-icon");
    const dropdown = document.getElementById("dropdown");

    db.ref("users/" + user.uid + "/profileImage").once("value")
      .then(snapshot => {
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

    icon.onclick = () => {
      dropdown.classList.toggle("hidden");
    };

   db.ref("users/" + user.uid + "/points").on("value", snapshot => {
  userBalance = snapshot.val() || 0;

  // Update balance display
  const balanceEl = document.getElementById("balance-display");
  if (balanceEl) {
    balanceEl.textContent = `Balance: $${userBalance.toFixed(2)}`;
  }
});
  }
});

function logout() {
  auth.signOut().then(() => {
    window.location.href = "index.html";
  });
}

function viewProfile() {
  window.location.href = "profile.html";
}

document.addEventListener("click", (e) => {
  const wrapper = document.getElementById("profile-wrapper");
  if (!wrapper.contains(e.target)) {
    document.getElementById("dropdown").classList.add("hidden");
  }
});

function getCrashPoint() {
  const r = Math.random();
  const houseEdge = 0.99;
  let crash = 1 / r;

  if (crash > 5) {
    const reduction = (crash - 5) / 100;
    if (Math.random() < reduction) {
      crash = Math.random() * 5;
    }
  }

  crash *= houseEdge;
  return Math.max(1.01, Math.floor(crash * 100) / 100);
}

function drawRocketAndPath(multiplier, crashedAt = null) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const maxMult = Math.max(multiplier, crashedAt || 1);
  const xSpan = maxMult * 30 + 100;
  const ySpan = Math.pow(maxMult * 30, 1.3) * 0.1 + 100;
  const xScale = canvas.width / xSpan;
  const yScale = canvas.height / ySpan;

  const rocketGraphX = multiplier * 30;
  const rocketGraphY = Math.pow(rocketGraphX, 1.3) * 0.1;
  const rocketScreenX = 50 + rocketGraphX * xScale;
  const rocketScreenY = canvas.height - 50 - rocketGraphY * yScale;
  const offsetX = rocketScreenX - canvas.width / 2;
  const offsetY = rocketScreenY - canvas.height / 2;

  ctx.beginPath();
  for (let x = 0; x <= maxMult * 30; x++) {
    const graphY = Math.pow(x, 1.3) * 0.1;
    const scaledX = 50 + x * xScale - offsetX;
    const scaledY = canvas.height - 50 - graphY * yScale - offsetY + 50;
    if (x === 0) {
      ctx.moveTo(scaledX, scaledY);
    } else {
      ctx.lineTo(scaledX, scaledY);
    }
  }
  ctx.strokeStyle = "#00ff99";
  ctx.lineWidth = 2;
  ctx.stroke();

  const rocketX = 50 + rocketGraphX * xScale - offsetX;
  const rocketY = canvas.height - 50 - rocketGraphY * yScale - offsetY + 50;
  ctx.fillStyle = "white";
  ctx.fillRect(rocketX - 5, rocketY - 10, 10, 20);

  if (crashedAt !== null) {
    const crashGraphX = crashedAt * 30;
    const crashGraphY = Math.pow(crashGraphX, 1.3) * 0.1;
    const crashX = 50 + crashGraphX * xScale - offsetX;
    const crashY = canvas.height - 50 - crashGraphY * yScale - offsetY + 50;
    ctx.font = "24px sans-serif";
    ctx.fillText("💥", crashX - 12, crashY - 15);
  }
}

function animateRocket(bet) {
  const startTime = performance.now();
  let hasCashedOut = false;

  function update(time) {
    const elapsed = (time - startTime) / 1000;
    multiplier = 1 + elapsed * 0.5;
    multiplierDisplay.textContent = multiplier.toFixed(2) + "x";

    if (!hasCashedOut && autoToggle.checked) {
      const autoMultiplier = parseFloat(autoMultiplierInput.value);
      if (!isNaN(autoMultiplier) && multiplier >= autoMultiplier) {
        cashOut = true;
      }
    }

    if (cashOut && !hasCashedOut) {
      const winnings = bet * multiplier;
      db.ref("users/" + currentUser.uid + "/points").transaction(current => (current || 0) + winnings);
      statusDisplay.textContent = `✅ Cashed out at ${multiplier.toFixed(2)}x! +$${winnings.toFixed(2)}`;
      hasCashedOut = true;
    }

    drawRocketAndPath(multiplier, crashed ? crashPoint : null);

    if (multiplier >= crashPoint) {
      if (!hasCashedOut) {
        statusDisplay.textContent = `💥 Crashed at ${crashPoint.toFixed(2)}x. You lost $${bet.toFixed(2)}`;
      }
      crashed = true;
      resetButtons();
      return;
    }

    animationFrame = requestAnimationFrame(update);
  }

  animationFrame = requestAnimationFrame(update);
}

function startGame() {
  const bet = parseFloat(betInput.value);
  if (isNaN(bet) || bet <= 0) {
    alert("Enter a valid bet.");
    return;
  }

  if (bet > userBalance) {
    alert("Insufficient balance.");
    return;
  }

  db.ref("users/" + currentUser.uid + "/points").transaction(current => (current || 0) - bet);

  multiplier = 1.0;
  crashed = false;
  cashOut = false;
  crashPoint = getCrashPoint();
  statusDisplay.textContent = "";
  startBtn.disabled = true;
  cashOutBtn.disabled = false;
  animateRocket(bet);
}

function resetButtons() {
  startBtn.disabled = false;
  cashOutBtn.disabled = true;
  cancelAnimationFrame(animationFrame);
}

startBtn.onclick = startGame;
cashOutBtn.onclick = () => {
  cashOut = true;
};
