const auth = firebase.auth();
const db = firebase.database();
const message = document.getElementById('message');

function signIn() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  auth.signInWithEmailAndPassword(email, password)
    .then((userCredential) => {
      const user = userCredential.user;

      // Always update user record on login
      const emailPrefix = user.email.split("@")[0];
      db.ref("users/" + user.uid).update({
        email: user.email,
        username: emailPrefix,       // ensures username is always set
        photoURL: user.photoURL || `https://i.pravatar.cc/150?u=${emailPrefix}`
      });

      message.textContent = "Success! Redirecting...";
      window.location.href = "home.html";
    })
    .catch(() => {
      message.textContent = "Account not found. Try signing up.";
    });
}

function signUp() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  auth.createUserWithEmailAndPassword(email, password)
    .then((userCredential) => {
      const user = userCredential.user;

      // Update Firebase Auth profile
      return user.updateProfile({
        displayName: "User",
        photoURL: `https://i.pravatar.cc/150?u=${email}`
      }).then(() => {
        // Create user record in Realtime DB
        return db.ref("users/" + user.uid).set({
          email: email,
          username: email.split("@")[0], // default username = email prefix
          points: 0,
          photoURL: user.photoURL
        });
      });
    })
    .then(() => {
      message.textContent = "Account created!";
      window.location.href = "home.html";
    })
    .catch(err => {
      message.textContent = `Error: ${err.message}`;
    });
}
