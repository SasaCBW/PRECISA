
import { auth, db } from "./firebase-config.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const loginForm = document.querySelector("#loginForm");
const registerForm = document.querySelector("#registerForm");
const errorBox = document.querySelector("#authError");
const submitButton = document.querySelector("#submitButton");

function showError(message) {
  if (errorBox) errorBox.textContent = message;
}

function friendlyError(error) {
  const messages = {
    "auth/invalid-email": "O e-mail informado não é válido.",
    "auth/user-not-found": "Não encontramos uma conta com esse e-mail.",
    "auth/wrong-password": "A senha está incorreta.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/email-already-in-use": "Esse e-mail já está cadastrado.",
    "auth/weak-password": "Escolha uma senha mais segura, com pelo menos 8 caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco e tente novamente.",
    "permission-denied": "O Firebase bloqueou a operação. Confira as regras do Firestore."
  };
  return messages[error.code] || error.message || "Ocorreu um erro. Tente novamente.";
}

onAuthStateChanged(auth, user => {
  if (user && (loginForm || registerForm)) {
    location.href = "index.html";
  }
});

if (loginForm) {
  loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    showError("");

    const email = document.querySelector("#email").value.trim();
    const password = document.querySelector("#password").value;

    submitButton.disabled = true;
    submitButton.textContent = "Entrando...";

    try {
      await signInWithEmailAndPassword(auth, email, password);
      location.href = "index.html";
    } catch (error) {
      console.error(error);
      showError(friendlyError(error));
      submitButton.disabled = false;
      submitButton.textContent = "Entrar";
    }
  });
}

if (registerForm) {
  registerForm.addEventListener("submit", async event => {
    event.preventDefault();
    showError("");

    const name = document.querySelector("#name").value.trim();
    const username = document.querySelector("#username").value.trim().toLowerCase();
    const email = document.querySelector("#email").value.trim();
    const password = document.querySelector("#password").value;

    if (name.length < 2) return showError("Informe seu nome.");
    if (!/^[a-z0-9_.]{3,24}$/.test(username)) {
      return showError("O usuário deve ter de 3 a 24 caracteres: letras, números, ponto ou underline.");
    }
    if (password.length < 8) return showError("A senha precisa ter pelo menos 8 caracteres.");

    submitButton.disabled = true;
    submitButton.textContent = "Criando conta...";

    try {
      const usernameRef = doc(db, "usernames", username);
      const usernameSnapshot = await getDoc(usernameRef);

      if (usernameSnapshot.exists()) {
        showError("Esse nome de usuário já está sendo utilizado.");
        submitButton.disabled = false;
        submitButton.textContent = "Criar minha conta";
        return;
      }

      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: name });

      await setDoc(doc(db, "users", credential.user.uid), {
        name,
        username,
        bio: "",
        photoURL: "",
        createdAt: serverTimestamp()
      });

      await setDoc(usernameRef, {
        uid: credential.user.uid,
        createdAt: serverTimestamp()
      });

      location.href = "index.html";
    } catch (error) {
      console.error(error);
      showError(friendlyError(error));
      submitButton.disabled = false;
      submitButton.textContent = "Criar minha conta";
    }
  });
}
