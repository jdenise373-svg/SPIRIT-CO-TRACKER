// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Optional: only import Analytics if running in a browser (not SSR)
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
   apiKey: "AIzaSyDOrlhhOY8anp9gAlM5wlXsBfhYe-pjAA8",
  authDomain: "spirit-co-tracker.firebaseapp.com",
  projectId: "spirit-co-tracker",
  storageBucket: "spirit-co-tracker.firebasestorage.app",
  messagingSenderId: "587421865283",
  appId: "1:587421865283:web:b58af950daaa93ce450bf6",
  measurementId: "G-KQGZ3F3E97",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase Services
const auth = getAuth(app);
const db = getFirestore(app);

// Optional: Safely load analytics only if supported
let analytics;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
});

export { auth, db, analytics };
