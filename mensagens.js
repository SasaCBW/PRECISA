
import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged
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
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const FALLBACK = "https://placehold.co/100x100/5865f2/ffffff?text=C";

let user = null;
let profile = null;
let activeChatId = null;
let unsubscribeChat = null;
let unsubscribeConversations = null;
let currentTab = "conversations";
let knownUsers = new Map();

function notice(message) {
  const element = $("notice");
  element.textContent = message;
  element.classList.add("show");
  setTimeout(() => element.classList.remove("show"), 2800);
}

function username(value) {
  return String(value || "").trim().toLowerCase().replace(/^@/, "");
}

function chatIdFor(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}

function showSection(section) {
  $("welcome").classList.toggle("hidden", section !== "welcome");
  $("chatSection").classList.toggle("hidden", section !== "chat");
  $("searchResults").classList.toggle("hidden", section !== "search");
}

function timeLabel(timestamp) {
  if (!timestamp?.toDate) return "agora";
  return timestamp.toDate().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function getUser(uid) {
  if (knownUsers.has(uid)) return knownUsers.get(uid);

  const snapshot = await getDoc(doc(db, "users", uid));
  if (!snapshot.exists()) return null;

  const data = { uid, ...snapshot.data() };
  knownUsers.set(uid, data);
  return data;
}

function makePersonButton(person, subtitle, actionText, action) {
  const button = document.createElement("button");
  button.className = "conversation-item";

  const avatar = document.createElement("img");
  avatar.src = person.photoURL || FALLBACK;
  avatar.alt = "";

  const details = document.createElement("span");
  const name = document.createElement("strong");
  name.textContent = person.name || "Usuário";

  const sub = document.createElement("small");
  sub.textContent = subtitle || "@" + (person.username || "usuario");

  details.append(name, sub);
  button.append(avatar, details);

  if (actionText) {
    const actionLabel = document.createElement("small");
    actionLabel.textContent = actionText;
    actionLabel.style.marginLeft = "auto";
    button.append(actionLabel);
  }

  button.addEventListener("click", action);
  return button;
}

async function loadConversations() {
  const list = $("sidebarList");
  list.innerHTML = '<p class="muted">Carregando conversas...</p>';

  if (unsubscribeConversations) unsubscribeConversations();

  const q = query(
    collection(db, "directChats"),
    where("participants", "array-contains", user.uid)
  );

  unsubscribeConversations = onSnapshot(q, async (snapshot) => {
    list.innerHTML = "";

    if (snapshot.empty) {
      list.innerHTML = '<p class="muted">Você ainda não tem conversas.</p>';
      return;
    }

    for (const chatDoc of snapshot.docs) {
      const data = chatDoc.data();
      const otherUid = (data.participants || []).find((uid) => uid !== user.uid);
      if (!otherUid) continue;

      const person = await getUser(otherUid);
      if (!person) continue;

      const item = makePersonButton(
        person,
        data.lastMessage || "Comece uma conversa",
        "",
        () => openConversation(otherUid, person)
      );

      item.classList.toggle("active", chatDoc.id === activeChatId);
      list.append(item);
    }
  }, (error) => {
    console.error(error);
    list.innerHTML = '<p class="muted">Não foi possível carregar as conversas.</p>';
  });
}

async function loadFriends() {
  const list = $("sidebarList");
  list.innerHTML = '<p class="muted">Carregando amigos...</p>';

  try {
    const snapshot = await getDocs(
      collection(db, "users", user.uid, "friends")
    );

    list.innerHTML = "";

    if (snapshot.empty) {
      list.innerHTML = '<p class="muted">Você ainda não adicionou amigos.</p>';
      return;
    }

    for (const friendDoc of snapshot.docs) {
      const person = await getUser(friendDoc.id);
      if (!person) continue;

      list.append(makePersonButton(
        person,
        "@" + (person.username || "usuario"),
        "Conversar",
        () => openConversation(person.uid, person)
      ));
    }
  } catch (error) {
    console.error(error);
    list.innerHTML = '<p class="muted">Erro ao carregar amigos.</p>';
  }
}

async function loadRequests() {
  const list = $("sidebarList");
  list.innerHTML = '<p class="muted">Carregando solicitações...</p>';

  try {
    const requestsQuery = query(
      collection(db, "friendRequests"),
      where("receiverId", "==", user.uid),
      where("status", "==", "pending")
    );

    const snapshot = await getDocs(requestsQuery);
    list.innerHTML = "";

    if (snapshot.empty) {
      list.innerHTML = '<p class="muted">Nenhuma solicitação pendente.</p>';
      return;
    }

    for (const requestDoc of snapshot.docs) {
      const request = requestDoc.data();
      const person = await getUser(request.senderId);
      if (!person) continue;

      const item = makePersonButton(
        person,
        "Quer adicionar você",
        "Aceitar",
        async () => acceptRequest(requestDoc.id, request.senderId)
      );

      list.append(item);
    }
  } catch (error) {
    console.error(error);
    list.innerHTML = '<p class="muted">Erro ao carregar solicitações.</p>';
  }
}

async function loadTab() {
  if (currentTab === "conversations") return loadConversations();
  if (currentTab === "friends") return loadFriends();
  if (currentTab === "requests") return loadRequests();
}

async function searchUsers() {
  const term = username($("searchInput").value);

  if (term.length < 2) {
    notice("Digite pelo menos 2 letras.");
    return;
  }

  showSection("search");
  $("peopleList").innerHTML = '<p class="muted">Pesquisando...</p>';

  try {
    const q = query(
      collection(db, "users"),
      where("usernameLower", ">=", term),
      where("usernameLower", "<=", term + "\uf8ff"),
      limit(20)
    );

    const snapshot = await getDocs(q);
    const results = snapshot.docs.filter((item) => item.id !== user.uid);
    const container = $("peopleList");
    container.innerHTML = "";

    if (!results.length) {
      container.innerHTML = '<p class="muted">Nenhuma pessoa encontrada.</p>';
      return;
    }

    for (const result of results) {
      const person = { uid: result.id, ...result.data() };
      knownUsers.set(person.uid, person);

      const card = document.createElement("div");
      card.className = "person-result";

      const avatar = document.createElement("img");
      avatar.src = person.photoURL || FALLBACK;

      const details = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = person.name || "Usuário";
      const handle = document.createElement("span");
      handle.textContent = "@" + (person.username || "usuario");
      details.append(name, handle);

      const button = document.createElement("button");
      button.textContent = "Adicionar";
      button.addEventListener("click", () => sendFriendRequest(person.uid));

      card.append(avatar, details, button);
      container.append(card);
    }
  } catch (error) {
    console.error(error);
    $("peopleList").innerHTML =
      '<p class="muted">Não foi possível pesquisar usuários.</p>';
  }
}

async function sendFriendRequest(receiverId) {
  if (receiverId === user.uid) return;

  const requestId = `${user.uid}_${receiverId}`;
  const requestRef = doc(db, "friendRequests", requestId);

  try {
    const existing = await getDoc(requestRef);

    if (existing.exists()) {
      const data = existing.data();
      if (data.status === "pending") {
        notice("Você já enviou essa solicitação.");
        return;
      }
      if (data.status === "accepted") {
        notice("Vocês já são amigos.");
        return;
      }
    }

    await setDoc(requestRef, {
      senderId: user.uid,
      receiverId,
      status: "pending",
      createdAt: serverTimestamp()
    });

    notice("Solicitação de amizade enviada!");
  } catch (error) {
    console.error(error);
    notice("Não foi possível enviar a solicitação.");
  }
}

async function acceptRequest(requestId, senderId) {
  try {
    const requestRef = doc(db, "friendRequests", requestId);
    const snapshot = await getDoc(requestRef);

    if (!snapshot.exists()) {
      notice("Essa solicitação não está mais disponível.");
      await loadRequests();
      return;
    }

    const request = snapshot.data();

    if (request.receiverId !== user.uid || request.status !== "pending") {
      notice("Não foi possível aceitar essa solicitação.");
      return;
    }

    await updateDoc(requestRef, {
      status: "accepted",
      acceptedAt: serverTimestamp()
    });

    await Promise.all([
      setDoc(doc(db, "users", user.uid, "friends", senderId), {
        uid: senderId,
        createdAt: serverTimestamp()
      }),
      setDoc(doc(db, "users", senderId, "friends", user.uid), {
        uid: user.uid,
        createdAt: serverTimestamp()
      })
    ]);

    notice("Amizade adicionada!");
    await loadRequests();
  } catch (error) {
    console.error(error);
    notice("Não foi possível aceitar. Verifique as regras do Firestore.");
  }
}

async function openConversation(otherUid, person) {
  if (unsubscribeChat) unsubscribeChat();

  const id = chatIdFor(user.uid, otherUid);
  const chatRef = doc(db, "directChats", id);

  try {
    const existing = await getDoc(chatRef);

    if (!existing.exists()) {
      await setDoc(chatRef, {
        participants: [user.uid, otherUid].sort(),
        createdAt: serverTimestamp(),
        lastMessage: "",
        updatedAt: serverTimestamp()
      });
    }

    activeChatId = id;
    $("chatName").textContent = person.name || "Usuário";
    $("chatStatus").textContent = "@" + (person.username || "usuario");
    $("chatAvatar").src = person.photoURL || FALLBACK;

    showSection("chat");
    listenToChat(id);
    loadTab();
  } catch (error) {
    console.error(error);
    notice("Não foi possível abrir a conversa.");
  }
}

function listenToChat(chatId) {
  const messagesRef = collection(db, "directChats", chatId, "messages");
  const q = query(messagesRef, orderBy("createdAt", "asc"), limit(100));

  unsubscribeChat = onSnapshot(q, (snapshot) => {
    const container = $("dmMessages");
    container.innerHTML = "";

    snapshot.forEach((messageDoc) => {
      const message = messageDoc.data();

      const row = document.createElement("article");
      row.className = "dm-message";

      const avatar = document.createElement("img");
      avatar.src = message.photoURL || FALLBACK;
      avatar.alt = "";

      const content = document.createElement("div");
      content.className = "dm-message-content";

      const meta = document.createElement("div");
      meta.className = "dm-message-meta";

      const name = document.createElement("strong");
      name.textContent = message.authorName || "Usuário";

      const time = document.createElement("time");
      time.textContent = timeLabel(message.createdAt);

      meta.append(name, time);

      const text = document.createElement("p");
      text.textContent = message.text || "";

      content.append(meta, text);
      row.append(avatar, content);
      container.append(row);
    });

    container.scrollTop = container.scrollHeight;
  }, (error) => {
    console.error(error);
    notice("Erro ao receber mensagens.");
  });
}

async function sendDirectMessage(event) {
  event.preventDefault();

  const text = $("dmInput").value.trim();
  if (!text || !activeChatId) return;

  const button = $("dmForm").querySelector("button");
  button.disabled = true;

  try {
    const chatRef = doc(db, "directChats", activeChatId);
    const chatSnapshot = await getDoc(chatRef);

    if (!chatSnapshot.exists() ||
        !chatSnapshot.data().participants?.includes(user.uid)) {
      throw new Error("Você não tem acesso a essa conversa.");
    }

    await addDoc(collection(db, "directChats", activeChatId, "messages"), {
      text,
      authorId: user.uid,
      authorName: profile.name || "Usuário",
      photoURL: profile.photoURL || FALLBACK,
      createdAt: serverTimestamp()
    });

    await updateDoc(chatRef, {
      lastMessage: text.slice(0, 100),
      updatedAt: serverTimestamp()
    });

    $("dmInput").value = "";
  } catch (error) {
    console.error(error);
    notice(error.message || "Não foi possível enviar a mensagem.");
  } finally {
    button.disabled = false;
  }
}

function bindTabs() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", async () => {
      document.querySelectorAll(".tab").forEach((item) => {
        item.classList.remove("active");
      });

      button.classList.add("active");
      currentTab = button.dataset.tab;
      showSection("welcome");
      await loadTab();
    });
  });
}

function bindEvents() {
  $("searchButton").addEventListener("click", searchUsers);

  $("searchInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") searchUsers();
  });

  $("dmForm").addEventListener("submit", sendDirectMessage);
  bindTabs();
}

bindEvents();

onAuthStateChanged(auth, async (authenticatedUser) => {
  if (!authenticatedUser) {
    window.location.href = "login.html";
    return;
  }

  user = authenticatedUser;

  try {
    const profileSnapshot = await getDoc(doc(db, "users", user.uid));

    if (!profileSnapshot.exists()) {
      notice("Seu perfil ainda não foi criado. Entre pelo painel principal primeiro.");
      return;
    }

    profile = profileSnapshot.data();
    await loadConversations();
  } catch (error) {
    console.error(error);
    notice("Não foi possível carregar suas mensagens.");
  }
});
