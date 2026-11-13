
// ==========================================
// CONNECT — CONFIGURAÇÃO FIREBASE
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  where,
  onSnapshot,
  serverTimestamp,
  setDoc,
  increment,
  arrayUnion,
  arrayRemove
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBZGIf6-yEwI_JxGsB129v5hOljUVBRpTY",
  authDomain: "precisa-connect.firebaseapp.com",
  projectId: "precisa-connect",
  storageBucket: "precisa-connect.firebasestorage.app",
  messagingSenderId: "145903851008",
  appId: "1:145903851008:web:6433186468e993e443aae5",
  measurementId: "G-EHXQ6L26KX"
};

// Inicialização
const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Exportações
export {
  app,
  auth,
  db,
  storage,

  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,

  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  where,
  onSnapshot,
  serverTimestamp,
  setDoc,
  increment,
  arrayUnion,
  arrayRemove,

  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
};

console.log("Connect conectado ao Firebase!");
