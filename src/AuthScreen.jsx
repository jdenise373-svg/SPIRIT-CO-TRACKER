import React, { useState } from "react";
import { auth as firebaseAuth } from "./Firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";

const AuthScreen = ({ onAuthSuccess }) => {
  const [authMode, setAuthMode] = useState("login"); // 'login' or 'signup'
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError(""); // Clear previous errors
    try {
      if (authMode === "login") {
        await signInWithEmailAndPassword(firebaseAuth, authEmail, authPassword);
        // On successful login, onAuthStateChanged will trigger and set userId,
        // which will cause the app to proceed and hide the modal.
      } else if (authMode === "signup") {
        await createUserWithEmailAndPassword(firebaseAuth, authEmail, authPassword);
        // On successful signup, onAuthStateChanged will trigger and set userId.
      }
      // Clear form on success
      setAuthEmail("");
      setAuthPassword("");
    } catch (error) {
      console.error("Authentication error:", error);
      let message = "Authentication failed.";
      if (error.code === "auth/user-not-found") {
        message = "No user found with this email.";
      } else if (error.code === "auth/wrong-password") {
        message = "Incorrect password.";
      } else if (error.code === "auth/email-already-in-use") {
        message = "Email is already in use.";
      } else if (error.code === "auth/invalid-email") {
        message = "Invalid email address.";
      } else if (error.code === "auth/weak-password") {
        message = "Password is too weak.";
      }
      // Add more specific error handling as needed
      setAuthError(message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4 text-center">
          {authMode === "login" ? "Login" : "Sign Up"}
        </h2>
        {authError && (
          <div className="bg-red-700 p-2 rounded mb-4 text-center">
            {authError}
          </div>
        )}
        <form onSubmit={handleAuth}>
          <div className="mb-4">
            <label
              htmlFor="authEmail"
              className="block text-sm font-medium mb-1"
            >
              Email
            </label>
            <input
              type="email"
              id="authEmail"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              required
              className="w-full bg-gray-700 p-2 rounded"
              placeholder="your@email.com"
            />
          </div>
          <div className="mb-4">
            <label
              htmlFor="authPassword"
              className="block text-sm font-medium mb-1"
            >
              Password
            </label>
            <input
              type="password"
              id="authPassword"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              required
              className="w-full bg-gray-700 p-2 rounded"
              placeholder="Password"
            />
          </div>
          <div className="flex flex-col space-y-3">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 py-2 px-4 rounded-lg shadow-md"
            >
              {authMode === "login" ? "Login" : "Sign Up"}
            </button>
            <button
              type="button"
              onClick={() =>
                setAuthMode(authMode === "login" ? "signup" : "login")
              }
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              {authMode === "login"
                ? "Don't have an account? Sign Up"
                : "Already have an account? Login"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthScreen;
