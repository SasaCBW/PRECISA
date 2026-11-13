
import { auth, db, storage } from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const $ = (id) => document.getElementById(id);

const DEFAULT_AVATAR = "https://placehold.co/160x160/5865f2/ffffff?text=C";

let currentUser = null;
let currentProfile = null;
let currentServerId = null;
let currentChannelId = null;
let currentChannelName = "geral";
let unsubscribeMessages = null;
let unsubscribeServers = null;
let unsubscribeChannels = null;
let selectedProfileFile = null;
let selectedMessageFile = null;
let toastTimeout = null;

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 3000);
}

function openModal(id) {
  $(id)?.classList.remove("hidden");
}

function closeModal(id) {
  $(id)?.classList.add("hidden");
}

function safeText(value) {
  return String(value ?? "");
}

function makeAvatar(name) {
  const letter = encodeURIComponent((name || "C").trim().charAt(0).toUpperCase());
  return `https://placehold.co/100x100/5865f2/ffffff?text=${letter}`;
}

function formatTime(timestamp) {
  if (!timestamp?.toDate) return "agora";
  return timestamp.toDate().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function cleanUsername(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9_.]/g, "");
}

function setVisible(id, visible) {
  $(id)?.classList.toggle("hidden", !visible);
}

function showChatView() {
  setVisible("chatPanel", true);
  setVisible("friendsPanel", false);
  setVisible("welcomePanel", false);
}

function showFriendsView() {
  setVisible("chatPanel", false);
  setVisible("welcomePanel", false);
  setVisible("friendsPanel", true);
  document.querySelectorAll(".sidebar-link").forEach((button) => {
    button.classList.toggle("active", button.id === "friendsButton");
  });
}

async function loadOrCreateProfile(user) {
  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);

  if (snapshot.exists()) {
    currentProfile = snapshot.data();
    if (!currentProfile.username) {
      const fallback = cleanUsername(user.email?.split("@")[0] || "usuario");
      await updateDoc(userRef, {
        username: fallback,
        usernameLower: fallback,
        updatedAt: serverTimestamp()
      });
      currentProfile.username = fallback;
      currentProfile.usernameLower = fallback;
    }
  } else {
    const fallback = cleanUsername(user.email?.split("@")[0] || "usuario");
    currentProfile = {
      uid: user.uid,
      name: user.displayName || "Novo usuário",
      username: fallback,
      usernameLower: fallback,
      bio: "",
      photoURL: user.photoURL || DEFAULT_AVATAR,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(userRef, currentProfile);
  }

  currentProfile.uid = user.uid;
  updateMyProfileDisplay();
}

function updateMyProfileDisplay() {
  if (!currentProfile) return;

  const name = currentProfile.name || "Usuário";
  const username = currentProfile.username || "usuario";
  const photo = currentProfile.photoURL || DEFAULT_AVATAR;

  $("myName").textContent = name;
  $("myUsername").textContent = "@" + username;
  $("myAvatar").src = photo;
  $("profilePhotoPreview").src = photo;
  $("profileNameInput").value = name;
  $("profileUsernameInput").value = username;
  $("profileBioInput").value = currentProfile.bio || "";
}

async function ensureInitialServer() {
  const serversQuery = query(
    collection(db, "servers"),
    where("members", "array-contains", currentUser.uid),
    limit(1)
  );

  const result = await getDocs(serversQuery);

  if (!result.empty) {
    const server = result.docs[0];
    currentServerId = server.id;
    await ensureGeneralChannel(server.id);
    return;
  }

  const serverRef = doc(collection(db, "servers"));
  await setDoc(serverRef, {
    name: "Minha comunidade",
    description: "Um espaço para conversar.",
    ownerId: currentUser.uid,
    members: [currentUser.uid],
    createdAt: serverTimestamp()
  });

  currentServerId = serverRef.id;
  await ensureGeneralChannel(serverRef.id);
}

async function ensureGeneralChannel(serverId) {
  const channelsRef = collection(db, "servers", serverId, "channels");
  const result = await getDocs(query(channelsRef, limit(1)));

  if (result.empty) {
    const channelRef = doc(channelsRef);
    await setDoc(channelRef, {
      name: "geral",
      description: "Converse com a comunidade",
      createdBy: currentUser.uid,
      createdAt: serverTimestamp()
    });
    currentChannelId = channelRef.id;
    currentChannelName = "geral";
  } else {
    currentChannelId = result.docs[0].id;
    currentChannelName = result.docs[0].data().name || "geral";
  }
}

function listenServers() {
  if (unsubscribeServers) unsubscribeServers();

  const q = query(
    collection(db, "servers"),
    where("members", "array-contains", currentUser.uid)
  );

  unsubscribeServers = onSnapshot(q, (snapshot) => {
    const container = $("serverList");
    container.innerHTML = "";

    snapshot.forEach((serverDoc) => {
      const server = serverDoc.data();
      const button = document.createElement("button");
      button.className = "server-icon" +
        (serverDoc.id === currentServerId ? " active" : "");
      button.title = server.name || "Comunidade";
      button.textContent = (server.name || "C").trim().charAt(0).toUpperCase();

      button.addEventListener("click", () => {
        selectServer(serverDoc.id, server.name || "Comunidade");
      });

      container.appendChild(button);
    });
  }, (error) => {
    console.error("Erro ao carregar comunidades:", error);
    showToast("Não foi possível carregar as comunidades.");
  });
}

async function selectServer(serverId, serverName) {
  currentServerId = serverId;
  currentChannelId = null;

  document.querySelectorAll(".server-icon").forEach((button) => {
    button.classList.remove("active");
  });

  if (unsubscribeChannels) unsubscribeChannels();

  const channelsRef = collection(db, "servers", serverId, "channels");
  const channelsQuery = query(channelsRef, orderBy("createdAt", "asc"));

  unsubscribeChannels = onSnapshot(channelsQuery, async (snapshot) => {
    const list = $("channelList");
    list.innerHTML = "";

    if (snapshot.empty) {
      await createChannel("geral", "Converse com a comunidade", serverId);
      return;
    }

    snapshot.forEach((channelDoc) => {
      const channel = channelDoc.data();
      const button = document.createElement("button");
      button.className = "channel-item" +
        (channelDoc.id === currentChannelId ? " active" : "");
      button.innerHTML = `<span>#</span><span class="channel-label"></span>`;
      button.querySelector(".channel-label").textContent = channel.name || "canal";

      button.addEventListener("click", () => {
        selectChannel(channelDoc.id, channel.name || "canal", channel.description || "");
      });

      list.appendChild(button);
    });

    if (!currentChannelId || !snapshot.docs.some((item) => item.id === currentChannelId)) {
      const first = snapshot.docs[0];
      const data = first.data();
      selectChannel(first.id, data.name || "geral", data.description || "");
    }
  }, (error) => {
    console.error("Erro nos canais:", error);
    showToast("Não foi possível carregar os canais.");
  });

  showChatView();
  $("currentChannelDescription").textContent = serverName;
}

function selectChannel(channelId, channelName, description = "") {
  currentChannelId = channelId;
  currentChannelName = channelName;

  $("currentChannelName").textContent = channelName;
  $("channelIntroName").textContent = channelName;
  $("currentChannelDescription").textContent = description || "Converse com a comunidade";
  $("messageInput").placeholder = `Enviar mensagem em #${channelName}`;

  document.querySelectorAll(".channel-item").forEach((button) => {
    button.classList.toggle(
      "active",
      button.querySelector(".channel-label")?.textContent === channelName
    );
  });

  listenMessages();
  loadServerMembers();
  showChatView();
}

function listenMessages() {
  if (unsubscribeMessages) unsubscribeMessages();

  if (!currentServerId || !currentChannelId) return;

  const messagesRef = collection(
    db,
    "servers",
    currentServerId,
    "channels",
    currentChannelId,
    "messages"
  );

  const q = query(messagesRef, orderBy("createdAt", "asc"), limit(100));

  unsubscribeMessages = onSnapshot(q, (snapshot) => {
    const list = $("messagesList");
    list.innerHTML = "";

    snapshot.forEach((messageDoc) => {
      renderMessage(messageDoc.data());
    });

    const area = $("messagesArea");
    area.scrollTop = area.scrollHeight;
  }, (error) => {
    console.error("Erro ao receber mensagens:", error);
    showToast("Erro ao carregar mensagens.");
  });
}

function renderMessage(message) {
  const list = $("messagesList");
  const wrapper = document.createElement("article");
  wrapper.className = "message";

  const avatar = document.createElement("img");
  avatar.className = "message-avatar";
  avatar.src = message.photoURL || makeAvatar(message.authorName);
  avatar.alt = "Foto de " + (message.authorName || "usuário");

  const content = document.createElement("div");
  content.className = "message-content";

  const meta = document.createElement("div");
  meta.className = "message-meta";

  const author = document.createElement("strong");
  author.textContent = message.authorName || "Usuário";

  const time = document.createElement("time");
  time.textContent = formatTime(message.createdAt);

  meta.append(author, time);

  const text = document.createElement("p");
  text.className = "message-text";
  text.textContent = message.text || "";

  content.append(meta);
  if (message.text) content.append(text);

  if (message.imageURL) {
    const image = document.createElement("img");
    image.className = "message-image";
    image.src = message.imageURL;
    image.alt = "Imagem enviada na conversa";
    image.loading = "lazy";
    content.append(image);
  }

  wrapper.append(avatar, content);
  list.appendChild(wrapper);
}

async function sendMessage(event) {
  event.preventDefault();

  const text = $("messageInput").value.trim();

  if (!text && !selectedMessageFile) return;
  if (!currentServerId || !currentChannelId) {
    showToast("Selecione uma comunidade e um canal.");
    return;
  }

  const sendButton = document.querySelector(".send-button");
  sendButton.disabled = true;

  try {
    let imageURL = "";

    if (selectedMessageFile) {
      const file = selectedMessageFile;
      validateImage(file, 5);
      const imageRef = ref(
        storage,
        `message-images/${currentUser.uid}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "")}`
      );
      const uploaded = await uploadBytes(imageRef, file);
      imageURL = await getDownloadURL(uploaded.ref);
    }

    await addDoc(
      collection(
        db,
        "servers",
        currentServerId,
        "channels",
        currentChannelId,
        "messages"
      ),
      {
        text,
        imageURL,
        authorId: currentUser.uid,
        authorName: currentProfile.name || "Usuário",
        photoURL: currentProfile.photoURL || DEFAULT_AVATAR,
        createdAt: serverTimestamp()
      }
    );

    $("messageInput").value = "";
    $("messageImageInput").value = "";
    selectedMessageFile = null;
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    showToast(error.message || "Não foi possível enviar a mensagem.");
  } finally {
    sendButton.disabled = false;
  }
}

function validateImage(file, maxMB = 5) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Escolha um arquivo de imagem válido.");
  }
  if (file.size > maxMB * 1024 * 1024) {
    throw new Error(`A imagem deve ter no máximo ${maxMB} MB.`);
  }
}

async function saveProfile(event) {
  event.preventDefault();

  const name = $("profileNameInput").value.trim();
  const username = cleanUsername($("profileUsernameInput").value);
  const bio = $("profileBioInput").value.trim();
  const status = $("profileStatus");

  if (name.length < 2) {
    status.textContent = "Digite um nome com pelo menos 2 caracteres.";
    return;
  }

  if (username.length < 3) {
    status.textContent = "O usuário precisa ter pelo menos 3 caracteres.";
    return;
  }

  status.textContent = "Salvando...";

  try {
    let photoURL = currentProfile.photoURL || DEFAULT_AVATAR;

    if (selectedProfileFile) {
      validateImage(selectedProfileFile, 5);

      const file = selectedProfileFile;
      const photoRef = ref(
        storage,
        `profile-photos/${currentUser.uid}/avatar-${Date.now()}`
      );

      const uploaded = await uploadBytes(photoRef, file, {
        contentType: file.type
      });

      photoURL = await getDownloadURL(uploaded.ref);
    }

    const userRef = doc(db, "users", currentUser.uid);

    await updateDoc(userRef, {
      name,
      username,
      usernameLower: username,
      bio,
      photoURL,
      updatedAt: serverTimestamp()
    });

    currentProfile = {
      ...currentProfile,
      name,
      username,
      usernameLower: username,
      bio,
      photoURL
    };

    selectedProfileFile = null;
    $("profilePhotoInput").value = "";
    updateMyProfileDisplay();
    status.textContent = "Perfil atualizado!";
    showToast("Seu perfil foi atualizado.");
  } catch (error) {
    console.error("Erro ao salvar perfil:", error);
    status.textContent = error.message || "Não foi possível salvar.";
  }
}

async function createServer(event) {
  event.preventDefault();

  const name = $("serverNameInput").value.trim();
  const description = $("serverDescriptionInput").value.trim();

  if (name.length < 2) {
    showToast("Digite um nome para a comunidade.");
    return;
  }

  try {
    const serverRef = await addDoc(collection(db, "servers"), {
      name,
      description,
      ownerId: currentUser.uid,
      members: [currentUser.uid],
      createdAt: serverTimestamp()
    });

    const channelRef = doc(
      collection(db, "servers", serverRef.id, "channels")
    );

    await setDoc(channelRef, {
      name: "geral",
      description: "Converse com a comunidade",
      createdBy: currentUser.uid,
      createdAt: serverTimestamp()
    });

    $("createServerForm").reset();
    closeModal("createServerModal");
    currentServerId = serverRef.id;
    currentChannelId = channelRef.id;
    listenServers();
    await selectServer(serverRef.id, name);
    showToast("Comunidade criada!");
  } catch (error) {
    console.error("Erro ao criar comunidade:", error);
    showToast("Não foi possível criar a comunidade.");
  }
}

async function createChannel(name, description, serverId = currentServerId) {
  if (!serverId) {
    showToast("Selecione uma comunidade primeiro.");
    return;
  }

  const cleanName = name.trim().toLowerCase().replace(/\s+/g, "-");

  if (!cleanName) {
    showToast("Digite um nome para o canal.");
    return;
  }

  try {
    await addDoc(collection(db, "servers", serverId, "channels"), {
      name: cleanName,
      description: description || "",
      createdBy: currentUser.uid,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Erro ao criar canal:", error);
    showToast("Não foi possível criar o canal.");
    throw error;
  }
}

async function handleCreateChannel(event) {
  event.preventDefault();

  const name = $("channelNameInput").value;
  const description = $("channelDescriptionInput").value;

  try {
    await createChannel(name, description);
    $("createChannelForm").reset();
    closeModal("createChannelModal");
    showToast("Canal criado!");
  } catch {
    // O erro já foi exibido em createChannel.
  }
}

async function loadServerMembers() {
  if (!currentServerId) return;

  try {
    const serverSnapshot = await getDoc(doc(db, "servers", currentServerId));
    if (!serverSnapshot.exists()) return;

    const server = serverSnapshot.data();
    const memberIds = server.members || [];
    $("membersCount").textContent = memberIds.length;

    const list = $("membersList");
    list.innerHTML = "";

    for (const uid of memberIds.slice(0, 50)) {
      const userSnapshot = await getDoc(doc(db, "users", uid));
      if (!userSnapshot.exists()) continue;

      const user = userSnapshot.data();
      const item = document.createElement("div");
      item.className = "member-item";

      const avatar = document.createElement("img");
      avatar.src = user.photoURL || DEFAULT_AVATAR;
      avatar.alt = "";

      const info = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = user.name || "Usuário";
      const username = document.createElement("span");
      username.textContent = "@" + (user.username || "usuario");

      info.append(name, username);
      item.append(avatar, info);
      list.appendChild(item);
    }
  } catch (error) {
    console.error("Erro ao carregar participantes:", error);
  }
}

async function searchPeople() {
  const term = cleanUsername($("peopleSearchInput").value);

  if (term.length < 2) {
    showToast("Digite pelo menos 2 letras para pesquisar.");
    return;
  }

  const results = $("peopleResults");
  results.innerHTML = '<div class="empty-state">Pesquisando...</div>';

  try {
    const usersQuery = query(
      collection(db, "users"),
      where("usernameLower", ">=", term),
      where("usernameLower", "<=", term + "\uf8ff"),
      limit(20)
    );

    const snapshot = await getDocs(usersQuery);
    results.innerHTML = "";

    const people = snapshot.docs.filter((item) => item.id !== currentUser.uid);

    if (!people.length) {
      results.innerHTML = '<div class="empty-state">Nenhum usuário encontrado.</div>';
      return;
    }

    people.forEach((personDoc) => {
      const person = personDoc.data();
      const card = document.createElement("div");
      card.className = "person-card";

      const avatar = document.createElement("img");
      avatar.src = person.photoURL || DEFAULT_AVATAR;

      const info = document.createElement("div");
      info.className = "person-info";

      const name = document.createElement("strong");
      name.textContent = person.name || "Usuário";
      const username = document.createElement("span");
      username.textContent = "@" + (person.username || "usuario");

      info.append(name, username);

      const button = document.createElement("button");
      button.className = "primary-button";
      button.textContent = "Ver perfil";
      button.addEventListener("click", () => {
        showToast(`${person.name || "Usuário"} — ${person.bio || "Sem descrição."}`);
      });

      card.append(avatar, info, button);
      results.appendChild(card);
    });
  } catch (error) {
    console.error("Erro na pesquisa:", error);
    results.innerHTML = '<div class="empty-state">Não foi possível pesquisar agora.</div>';
  }
}

async function loadNotifications() {
  const list = $("notificationsList");
  list.innerHTML = '<div class="empty-state">Carregando...</div>';

  try {
    const q = query(
      collection(db, "users", currentUser.uid, "notifications"),
      orderBy("createdAt", "desc"),
      limit(30)
    );

    const snapshot = await getDocs(q);
    list.innerHTML = "";

    if (snapshot.empty) {
      list.innerHTML = '<div class="empty-state">Você ainda não tem notificações.</div>';
      return;
    }

    snapshot.forEach((item) => {
      const data = item.data();
      const row = document.createElement("div");
      row.className = "person-card";
      row.textContent = data.text || "Nova notificação";
      list.appendChild(row);
    });
  } catch (error) {
    console.error("Erro nas notificações:", error);
    list.innerHTML = '<div class="empty-state">Não foi possível carregar notificações.</div>';
  }
}

function bindEvents() {
  $("messageForm").addEventListener("submit", sendMessage);
  $("profileForm").addEventListener("submit", saveProfile);
  $("createServerForm").addEventListener("submit", createServer);
  $("createChannelForm").addEventListener("submit", handleCreateChannel);

  $("editProfileButton").addEventListener("click", () => openModal("profileModal"));
  $("myAvatarButton").addEventListener("click", () => openModal("profileModal"));
  $("openProfileButton").addEventListener("click", () => openModal("profileModal"));

  $("createServerButton").addEventListener("click", () => openModal("createServerModal"));
  $("welcomeCreateServer").addEventListener("click", () => openModal("createServerModal"));
  $("createChannelButton").addEventListener("click", () => {
    if (!currentServerId) {
      showToast("Selecione uma comunidade primeiro.");
      return;
    }
    openModal("createChannelModal");
  });

  $("attachButton").addEventListener("click", () => $("messageImageInput").click());

  $("messageImageInput").addEventListener("change", (event) => {
    selectedMessageFile = event.target.files?.[0] || null;
    if (selectedMessageFile) {
      try {
        validateImage(selectedMessageFile, 5);
        showToast("Imagem pronta para enviar junto com sua mensagem.");
      } catch (error) {
        selectedMessageFile = null;
        event.target.value = "";
        showToast(error.message);
      }
    }
  });

  $("profilePhotoInput").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      validateImage(file, 5);
      selectedProfileFile = file;
      $("profilePhotoPreview").src = URL.createObjectURL(file);
    } catch (error) {
      selectedProfileFile = null;
      event.target.value = "";
      showToast(error.message);
    }
  });

  $("peopleSearchButton").addEventListener("click", searchPeople);
  $("peopleSearchInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") searchPeople();
  });

  $("friendsButton").addEventListener("click", showFriendsView);
  $("directMessagesButton").addEventListener("click", () => {
    showToast("As mensagens diretas serão ativadas na próxima etapa.");
  });

  $("homeButton").addEventListener("click", () => {
    showChatView();
    if (currentServerId) selectServer(currentServerId, "Comunidade");
  });

  $("membersToggleButton").addEventListener("click", () => {
    $("membersPanel").classList.toggle("members-visible");
  });

  $("notificationsButton").addEventListener("click", async () => {
    openModal("notificationsModal");
    await loadNotifications();
  });

  $("logoutButton").addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "login.html";
    } catch (error) {
      console.error(error);
      showToast("Não foi possível sair da conta.");
    }
  });

  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.dataset.close));
  });

  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) modal.classList.add("hidden");
    });
  });
}

bindEvents();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  currentUser = user;

  try {
    await loadOrCreateProfile(user);
    await ensureInitialServer();

    $("loadingScreen").classList.add("hidden");
    $("app").classList.remove("hidden");

    listenServers();
    await selectServer(currentServerId, "Minha comunidade");
  } catch (error) {
    console.error("Falha ao iniciar o Connect:", error);
    $("loadingScreen").innerHTML =
      "<p>Não foi possível carregar o Connect. Verifique as configurações do Firebase e as regras de acesso.</p>";
  }
});
