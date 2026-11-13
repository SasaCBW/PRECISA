import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc,
  updateDoc
} from "./firebase-config.js";

const nameElement = document.getElementById("profileName");
const usernameElement = document.getElementById("profileUsername");
const bioElement = document.getElementById("profileBio");
const avatarElement = document.getElementById("profileAvatar");
const statusElement = document.getElementById("profileStatus");

const editForm = document.getElementById("profileEditForm");
const editButton = document.getElementById("editProfileButton");
const logoutButton = document.getElementById("logoutButton");

let currentUser = null;
let profileData = null;

function showStatus(text, error = false) {
  statusElement.textContent = text;
  statusElement.style.color = error ? "#d13e53" : "#218653";
}

function showProfile(data) {
  profileData = data;

  nameElement.textContent = data.name || "Usuário Connect";
  usernameElement.textContent = data.username ? `@${data.username}` : "";
  bioElement.textContent = data.bio || "Ainda não adicionou uma biografia.";

  avatarElement.textContent = (data.name || "C").charAt(0).toUpperCase();

  document.getElementById("followersCount").textContent =
    data.followersCount || 0;

  document.getElementById("followingCount").textContent =
    data.followingCount || 0;

  document.getElementById("editName").value = data.name || "";
  document.getElementById("editBio").value = data.bio || "";
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  currentUser = user;

  try {
    const profileRef = doc(db, "users", user.uid);
    const snapshot = await getDoc(profileRef);

    if (!snapshot.exists()) {
      showStatus("Não encontramos os dados do seu perfil.", true);
      return;
    }

    showProfile(snapshot.data());

  } catch (error) {
    console.error("Erro ao carregar perfil:", error);
    showStatus("Não foi possível carregar seu perfil.", true);
  }
});

editButton.addEventListener("click", () => {
  editForm.classList.toggle("open");
});

editForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentUser) return;

  const name = document.getElementById("editName").value.trim();
  const bio = document.getElementById("editBio").value.trim();
  const saveButton = document.getElementById("saveProfileButton");

  if (name.length < 2) {
    showStatus("Informe um nome válido.", true);
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = "Salvando...";

  try {
    await updateDoc(doc(db, "users", currentUser.uid), {
      name,
      bio
    });

    showProfile({
      ...profileData,
      name,
      bio
    });

    editForm.classList.remove("open");
    showStatus("Perfil atualizado com sucesso!");

  } catch (error) {
    console.error("Erro ao atualizar perfil:", error);
    showStatus("Não foi possível salvar as alterações.", true);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Salvar alterações";
  }
});

logoutButton.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch (error) {
    console.error("Erro ao sair:", error);
    showStatus("Não foi possível sair da conta.", true);
  }
});
