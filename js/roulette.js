window.addEventListener('DOMContentLoaded', () => {
  const auth = firebase.auth();
  const db = firebase.database();
  let balance = 0;

  const balanceEl = document.getElementById("balance");
  const wheel = document.getElementById("wheel");
  const messageEl = document.getElementById("message");

  function updateBalanceDisplay() {
    balanceEl.textContent = balance;
    const user = auth.currentUser;
    if (user) {
      db.ref("users/" + user.uid + "/points").set(balance);
    }
  }

  function loadBalanceFromFirebase() {
    const user = auth.currentUser;
    if (!user) {
      messageEl.textContent = "Please sign in to play.";
      return;
    }

    db.ref("users/" + user.uid + "/points").once("value")
      .then(snapshot => {
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

window.logout = function () {
  auth.signOut().then(() => {
    window.location.href = "index.html";
  });
};

window.viewProfile = function () {
  window.location.href = "profile.html";
};


  document.addEventListener("click", (e) => {
    const wrapper = document.getElementById("profile-wrapper");
    if (!wrapper.contains(e.target)) {
      document.getElementById("dropdown").classList.add("hidden");
    }
  });

  // Game logic
  document.getElementById("deposit").onclick = () => {
    balance += 100;
    updateBalanceDisplay();
  };

  document.getElementById("withdraw").onclick = () => {
    balance = 0;
    updateBalanceDisplay();
    messageEl.textContent = "You withdrew all your chips!";
  };

  document.getElementById("placeBet").onclick = () => {
    const placeBetBtn = document.getElementById("placeBet");
    const betColor = document.getElementById("betColor").value;
    const betAmount = parseInt(document.getElementById("betAmount").value);

    if (!betAmount || betAmount <= 0) {
      messageEl.textContent = "Please enter a valid bet amount.";
      return;
    }

    if (betAmount > balance) {
      messageEl.textContent = "Not enough chips!";
      return;
    }

    placeBetBtn.disabled = true;
    balance -= betAmount;
    updateBalanceDisplay();

    spinWheel(betColor, betAmount, () => {
      placeBetBtn.disabled = false;
    });
  };

  function spinWheel(betColor, betAmount, callback) {
    const fullRotations = Math.floor(Math.random() * 5) + 20;
    const endAngle = Math.floor(Math.random() * 360);
    const totalDegrees = fullRotations * 360 + endAngle;

    wheel.style.transition = "none";
    wheel.style.transform = `rotate(0deg)`;
    void wheel.offsetWidth;

    wheel.style.transition = "transform 3s ease";
    wheel.style.transform = `rotate(${totalDegrees}deg)`;

    const normalizedAngle = totalDegrees % 360;

    setTimeout(() => {
      let resultColor;
      if (normalizedAngle >= 0 && normalizedAngle < 9.73) {
        resultColor = "green";
      } else {
        const index = Math.floor((normalizedAngle - 9.73) / 9.73);
        resultColor = index % 2 === 0 ? "red" : "black";
      }

      let winnings = 0;
      if (betColor === resultColor) {
        winnings = resultColor === "green" ? betAmount * 14 : betAmount * 2;
        balance += winnings;
        messageEl.textContent = `It landed on ${resultColor}! You won $${winnings}!`;
      } else {
        messageEl.textContent = `It landed on ${resultColor}. You lost $${betAmount}.`;
      }

      updateBalanceDisplay();
      if (callback) callback();
    }, 3000);
  }
});
