const auth = firebase.auth();
const db = firebase.database();

let balance = 0;
let user = null;

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

function updateBalanceDisplay() {
  document.getElementById("balance").textContent = `Balance: $${balance.toFixed(2)}`;
  if (user) {
    db.ref("users/" + user.uid + "/points").set(parseFloat(balance.toFixed(2)));
  }
}

const targetSlider = document.getElementById("target");
const payoutDisplay = document.getElementById("payout");
const rollDisplay = document.getElementById("rollDisplay");
const message = document.getElementById("message");

targetSlider.addEventListener("input", () => {
  updatePayout();
});

document.getElementById("rollBtn").addEventListener("click", () => {
  const betAmount = parseFloat(document.getElementById("betAmount").value);
  const target = parseFloat(targetSlider.value);

  if (isNaN(betAmount) || betAmount <= 0) {
    message.textContent = "❗ Enter a valid bet.";
    return;
  }

  if (betAmount > balance) {
    message.textContent = "❌ Not enough balance.";
    return;
  }

  const roll = parseFloat((Math.random() * 100).toFixed(2));
rollDisplay.textContent = roll;

const pointer = document.getElementById("rollPointer");
const diceIcon = document.getElementById("diceIcon");

const currentLeft = parseFloat(pointer.style.left) || 0;
const targetLeft = roll;

const direction = targetLeft > currentLeft ? 'right' : 'left';
const rotationAmount = 360;
const rotation = direction === 'right' ? rotationAmount : -rotationAmount;

// Set transform
diceIcon.style.transform = `rotate(${rotation}deg)`;

// Move the pointer
pointer.style.left = `${targetLeft}%`;

// Optional: reset rotation after it lands
setTimeout(() => {
  diceIcon.style.transform = `rotate(0deg)`;
}, 500);



  const won = roll > target;
  const payoutMultiplier = 99 / (100 - target);
  const winnings = won ? +(betAmount * payoutMultiplier).toFixed(2) : 0;

  balance -= betAmount;
  if (won) {
    balance += winnings;
    message.textContent = `✅ You won $${winnings.toFixed(2)}!`;
  } else {
    message.textContent = `❌ You lost $${betAmount.toFixed(2)}.`;
  }

  updateBalanceDisplay();
});

function updatePayout() {
  const target = parseFloat(targetSlider.value);
  const payout = 99 / (100 - target);
  payoutDisplay.textContent = `${payout.toFixed(2)}x`;
  document.getElementById("targetDisplay").textContent = target.toFixed(2);

  // 🔴🟢 Slider gradient
  const percent = (target / 99) * 100;
  targetSlider.style.background = `linear-gradient(to right, red ${percent}%, green ${percent}%)`;
}

// Initialize once
updatePayout();
