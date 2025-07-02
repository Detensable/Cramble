const auth = firebase.auth();
const db = firebase.database();

auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const icon = document.getElementById("profile-icon");
  const dropdown = document.getElementById("dropdown");

  // Load profile image from database
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

  // Toggle dropdown
  icon.onclick = () => {
    dropdown.classList.toggle("hidden");
  };
});

function logout() {
  firebase.auth().signOut().then(() => {
    window.location.href = "index.html";
  });
}

function viewProfile() {
  window.location.href = "profile.html";
}

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  const wrapper = document.getElementById("profile-wrapper");
  if (!wrapper.contains(e.target)) {
    document.getElementById("dropdown").classList.add("hidden");
  }
});

// Build game grid
const games = [
  { name: 'Blackjack', img: 'images/blackjack.png', link: 'blackjack.html' },
  { name: 'Roulette', img: 'images/roulette.png', link: 'roulette.html' },
  { name: 'Slots', img: 'images/slots.png', link: 'slots.html' },
  { name: 'Option 4', img: 'images/option4.png', link: 'option4.html' },
];

function buildGrid() {
  const grid = document.getElementById("gameGrid");
  games.forEach(g => {
    const card = document.createElement("div");
    card.className = "game-card";
    card.onclick = () => window.location.href = g.link;
    card.innerHTML = `
      <img src="${g.img}" alt="${g.name}" />
      <div class="title">${g.name}</div>`;
    grid.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", buildGrid);
