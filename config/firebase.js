// <DOCUMENT filename="firebase.js">
const { initializeApp } = require("firebase/app");
const { getStorage } = require("firebase/storage");

const firebaseConfig = {
  apiKey: "AIzaSyDMjdgDvGx7euneViEfUMlAG7nKPtuerPU",
  authDomain: "manage-movie.firebaseapp.com",
  projectId: "manage-movie",
  storageBucket: "manage-movie.appspot.com",
  messagingSenderId: "759912275828",
  appId: "1:759912275828:web:e5690d21d59f472afa5621",
  measurementId: "G-ZXNB1T1CMG",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

module.exports = { app, storage };
// </DOCUMENT>
