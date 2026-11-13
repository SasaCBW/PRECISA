import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "./firebase-config.js";

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const message = document.getElementById("authMessage");

function showMessage(text, type = "error") {
  if (!message) return;
  message.textContent = text;
  message.className = `auth-message ${type}`;
}

function setLoading(button, loading, text) {
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? "Aguarde..." : text;
}

function explainError(error) {
  const errors = {
    "auth/invalid-email": "O endereço de e-mail não é válido.",
    "auth/user-not-found": "Não encontramos uma conta com esse e-mail.",
    "auth/wrong-password": "A senha informada está incorreta.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/email-already-in-use": "Este e-mail já está cadastrado.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco e tente novamente.",
    "auth/network-request-failed": "Falha de conexão. Verifique sua internet.",
    "permission-denied": "O Firebase bloqueou a operação. Verifique as regras do Firestore."
  };

  return errors[error.code] || "Não foi possível concluir. Confira os dados e tente novamente.";
}

/* LOGIN */

if (loginForm) {
  loginForm.addEventListener("submit", async event => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const button = document.getElementById("loginButton");

    setLoading(button, true, "Entrar na minha conta");
    showMessage("");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      showMessage("Login realizado! Redirecionando...", "success");

      setTimeout(() => {
        window.location.href = "index.html";
      }, 700);
    } catch (error) {
      console.error("Erro no login:", error);
      showMessage(explainError(error));
      setLoading(button, false, "Entrar na minha conta");
    }
  });
}

/* CADASTRO */

if (registerForm) {
  registerForm.addEventListener("submit", async event => {
    event.preventDefault();

    const name = document.getElementById("name").value.trim();
    const username = document.getElementById("username").value
      .trim()
      .toLowerCase()
      .replace(/^@/, "");
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const button = document.getElementById("registerButton");

    if (name.length < 2) {
      showMessage("Informe seu nome completo.");
      return;
    }

    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      showMessage("O usuário deve ter de 3 a 20 caracteres, usando letras, números ou _.");
      return;
    }

    if (password.length < 6) {
      showMessage("Sua senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      showMessage("As senhas não são iguais.");
      return;
    }

    setLoading(button, true, "Criar minha conta");
    showMessage("");

    try {
      const usernameRef = doc(db, "usernames", username);
      const usernameSnapshot = await getDoc(usernameRef);

      if (usernameSnapshot.exists()) {
        showMessage("Esse nome de usuário já está sendo utilizado.");
        setLoading(button, false, "Criar minha conta");
        return;
      }

      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      const user = credential.user;

      await updateProfile(user, {
        displayName: name
      });

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name,
        username,
        email,
        bio: "Olá! Estou usando o Connect.",
        photoURL: "",
        followersCount: 0,
        followingCount: 0,
        createdAt: serverTimestamp()
      });

      await setDoc(usernameRef, {
        uid: user.uid,
        username
      });

      showMessage("Conta criada com sucesso! Entrando...", "success");

      setTimeout(() => {
        window.location.href = "index.html";
      }, 900);

    } catch (error) {
      console.error("Erro no cadastro:", error);
      showMessage(explainError(error));
      setLoading(button, false, "Criar minha conta");
    }
  });
}
