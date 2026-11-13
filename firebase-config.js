
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBZGIf6-yEwI_JxGsB129v5hOljUVBRpTY",
  authDomain: "precisa-connect.firebaseapp.com",
  projectId: "precisa-connect",
  storageBucket: "precisa-connect.firebasestorage.app",
  messagingSenderId: "145903851008",
  appId: "1:145903851008:web:6433186468e993e443aae5",
  measurementId: "G-EHXQ6L26KX"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
