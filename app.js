const auth = firebase.auth();
const message = document.getElementById('message');

function signIn() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  auth.signInWithEmailAndPassword(email, password)
    .then(() => window.location.href = "home.html")
    .catch(() => message.textContent = "Not found. Try signing up.");
}

function signUp() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

auth.createUserWithEmailAndPassword(email, password)
  .then((userCredential) => {
    return userCredential.user.updateProfile({
      displayName: "Wyatt",
      photoURL: "https://i.pravatar.cc/150?u=" + email // you can use any image or gravatar-like service
    });
  })
  .then(() => window.location.href = "home.html")
  .catch(err => message.textContent = "Error signing up: " + err.message);

}
