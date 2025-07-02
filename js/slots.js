const auth = firebase.auth();
const db = firebase.database();
let balance = 0;

const symbols = ["🍒", "🍋", "🔔", "🍉", "💎", "7️⃣"];
const reels = [
  document.getElementById("reel1"),
  document.getElementById("reel2"),
  document.getElementById("reel3"),
];
const lever = document.getElementById("lever");
const betInput = document.getElementById("betAmount");
const balanceDisplay = document.getElementById("balance");
const message = document.getElementById("message");

let spinning = false;

function updateBalanceDisplay() {
  balanceDisplay.textContent = `Balance: $${balance}`;
  const user = auth.currentUser;
  if (user) {
    db.ref("users/" + user.uid + "/points").set(balance);
  }
}

function loadBalanceFromFirebase() {
  const user = auth.currentUser;
  if (!user) {
    message.textContent = "Please sign in.";
    return;
  }

  db.ref("users/" + user.uid + "/points").once("value").then(snapshot => {
    const saved = snapshot.val();
    balance = saved !== null ? parseInt(saved) : 1000;
    updateBalanceDisplay();
  });
}

auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "index.html";
  } else {
    loadBalanceFromFirebase();

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

    icon.onclick = () => {
      dropdown.classList.toggle("hidden");
    };
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

function spinReels(bet) {
  spinning = true;
  message.textContent = "";
  let results = [];

  reels.forEach((reel, i) => {
    let spins = 10 + i * 5;
    let count = 0;

    const spin = setInterval(() => {
      const rand = symbols[Math.floor(Math.random() * symbols.length)];
      reel.textContent = rand;
      count++;
      if (count >= spins) {
        clearInterval(spin);
        results[i] = rand;

        if (i === 2) {
          setTimeout(() => checkWin(results, bet), 300);
          spinning = false;
        }
      }
    }, 100);
  });
}

function checkWin(results, bet) {
  if (results[0] === results[1] && results[1] === results[2]) {
    const winnings = bet * 5;
    balance += winnings;
    message.textContent = `🎉 You won $${winnings}!`;
  } else if (results[0] === results[1] || results[1] === results[2] || results[0] === results[2]) {
    const winnings = bet * 2;
    balance += winnings;
    message.textContent = `👍 Pair! You won $${winnings}`;
  } else {
    message.textContent = `😢 You lost $${bet}`;
  }

  updateBalanceDisplay();
}

// Lever click event
lever.addEventListener("click", () => {
  if (spinning) return;

  const bet = parseInt(betInput.value);
  if (isNaN(bet) || bet <= 0) {
    message.textContent = "Enter a valid bet.";
    return;
  }
  if (bet > balance) {
    message.textContent = "Not enough balance!";
    return;
  }

  lever.style.transform = "translateY(20px)";
  setTimeout(() => {
    lever.style.transform = "translateY(0)";
    balance -= bet;
    updateBalanceDisplay();
    spinReels(bet);
  }, 150);
});

