const balanceUtils = (() => {
  const auth = firebase.auth();
  const db = firebase.database();

  function getBalance(callback) {
    const user = auth.currentUser;
    if (!user) return callback(0);

    db.ref("users/" + user.uid + "/points").once("value").then(snapshot => {
      const val = snapshot.val();
      callback(val !== null ? parseFloat(val) : 1000);
    });
  }

  function setBalance(newAmount) {
    const user = auth.currentUser;
    if (user) {
      db.ref("users/" + user.uid + "/points").set(newAmount);
    }
  }
  

  function updateBalance(change, callback) {
    getBalance(current => {
      const updated = current + change;
      setBalance(updated);
      if (callback) callback(updated);
    });
  }

  return { getBalance, setBalance, updateBalance };
})();
