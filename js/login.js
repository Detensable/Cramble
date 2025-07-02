const auth = firebase.auth();
const message = document.getElementById('message');

function signIn() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  auth.signInWithEmailAndPassword(email, password)
    .then(() => {
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
      return userCredential.user.updateProfile({
        displayName: "User",
        photoURL: `https://i.pravatar.cc/150?u=${email}`
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
