const db = firebase.database();
const leaderboardBody = document.getElementById("leaderboardBody");

function loadLeaderboard() {
  db.ref("users").once("value").then(snapshot => {
    let users = [];

    snapshot.forEach(child => {
      const data = child.val();

      // Try to get username → email prefix → uid
      let displayName = "";
      if (data.username) {
        displayName = data.username;
      } else if (data.email) {
        displayName = data.email.split("@")[0]; // take everything before '@'
      } else {
        displayName = child.key; // fallback to uid
      }

      users.push({
        username: displayName,
        points: data.points || 0
      });
    });

    // Sort descending by points
    users.sort((a, b) => b.points - a.points);

    // Display
    leaderboardBody.innerHTML = "";
    users.forEach((user, index) => {
      const row = `
        <tr>
          <td>#${index + 1}</td>
          <td>${user.username}</td>
          <td>${user.points}</td>
        </tr>
      `;
      leaderboardBody.innerHTML += row;
    });
  });
}

loadLeaderboard();
