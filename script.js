
import { auth, db, storage } from "./firebase-config.js";

import {
  onAuthStateChanged, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, deleteDoc,
  updateDoc, query, orderBy, limit, onSnapshot, serverTimestamp,
  increment, where
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import {
  ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let currentUser = null;
let currentUserData = {};
let posts = [];
let activeChatId = null;
let activeChatUser = null;
let stopPosts = null;
let stopMessages = null;
let stopNotifications = null;
let selectedImage = null;

function toast(message) {
  const element = $("#toast");
  if (!element) return;
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove("show"), 2800);
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function avatarHTML(user, size = "") {
  const name = user?.displayName || user?.name || user?.username || "C";
  const photo = user?.photoURL || user?.avatar || "";
  return `<div class="avatar ${size}">${photo ? `<img src="${escapeHTML(photo)}" alt="">` : escapeHTML(name.charAt(0).toUpperCase())}</div>`;
}

function dateLabel(timestamp) {
  const date = timestamp?.toDate ? timestamp.toDate() : new Date();
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

async function getUserData(uid) {
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? snapshot.data() : {};
}

function updateIdentity() {
  const name = currentUserData.name || currentUser.displayName || "Pessoa Connect";
  const username = currentUserData.username || currentUser.email?.split("@")[0] || "usuario";
  ["#sideAvatar", "#topAvatar", "#composerAvatar"].forEach(selector => {
    const el = $(selector);
    if (el) el.innerHTML = currentUserData.photoURL
      ? `<img src="${escapeHTML(currentUserData.photoURL)}" alt="">`
      : escapeHTML(name.charAt(0).toUpperCase());
  });
  if ($("#sideName")) $("#sideName").textContent = name;
  if ($("#sideUsername")) $("#sideUsername").textContent = "@" + username;
}

function showSection(name) {
  $$(".content-section").forEach(section => section.classList.remove("active"));
  $$(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.section === name));
  const section = $("#" + name + "Section");
  if (section) section.classList.add("active");
  const titles = { feed: "Início", search: "Explorar", messages: "Mensagens", notifications: "Notificações", profile: "Meu perfil" };
  $("#pageTitle").textContent = titles[name] || "Connect";
  if (name === "profile") renderMyProfile();
  if (name === "search") loadPeople($("#userSearchInput")?.value || "");
  if (name === "notifications") loadNotifications();
  if (name === "messages") loadConversations();
}

function openPostDialog() {
  $("#postDialog").showModal();
  $("#postText").focus();
}

async function loadFeed() {
  if (stopPosts) stopPosts();
  const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(60));
  stopPosts = onSnapshot(postsQuery, snapshot => {
    posts = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    renderFeed();
  }, error => {
    console.error(error);
    $("#postsContainer").innerHTML = '<p class="muted">Não foi possível carregar o feed. Verifique as regras do Firestore.</p>';
  });
}

function renderFeed() {
  const container = $("#postsContainer");
  if (!container) return;

  const sorted = [...posts];
  if ($("#feedFilter")?.value === "popular") sorted.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));

  if (!sorted.length) {
    container.innerHTML = '<div class="post-card"><p class="muted">Ainda não há publicações. Seja a primeira pessoa a compartilhar algo!</p></div>';
    return;
  }

  container.innerHTML = sorted.map(post => {
    const liked = Boolean(post.likedBy?.includes(currentUser.uid));
    const owner = post.authorId === currentUser.uid;
    return `
      <article class="post-card" data-post-id="${escapeHTML(post.id)}" data-author-id="${escapeHTML(post.authorId || "")}">
        <div class="post-header">
          ${avatarHTML({ name: post.authorName, photoURL: post.authorPhoto })}
          <div class="post-author">
            <strong>${escapeHTML(post.authorName || "Pessoa Connect")}</strong>
            <small>@${escapeHTML(post.authorUsername || "usuario")} · ${dateLabel(post.createdAt)}</small>
          </div>
          ${owner ? '<button class="post-menu delete-post" title="Excluir publicação">•••</button>' : ""}
        </div>
        <div class="post-text">${escapeHTML(post.text || "")}</div>
        ${post.imageURL ? `<img class="post-image" src="${escapeHTML(post.imageURL)}" alt="Imagem da publicação" loading="lazy">` : ""}
        <div class="post-stats"><span>${post.likesCount || 0} curtidas</span><span>${post.commentsCount || 0} comentários</span></div>
        <div class="post-actions">
          <button class="like-button ${liked ? "liked" : ""}">${liked ? "♥ Curtido" : "♡ Curtir"}</button>
          <button class="comment-button">▢ Comentar</button>
          <button class="share-button">↗ Compartilhar</button>
        </div>
        <div class="comments-area">
          <div class="comment-list" data-comments="${escapeHTML(post.id)}"></div>
          <form class="comment-form">
            <input name="comment" maxlength="1000" placeholder="Escreva um comentário..." required>
            <button type="submit">Enviar</button>
          </form>
        </div>
      </article>`;
  }).join("");

  sorted.forEach(post => loadComments(post.id));
}

async function loadComments(postId) {
  const area = document.querySelector(`[data-comments="${CSS.escape(postId)}"]`);
  if (!area) return;
  try {
    const q = query(collection(db, "posts", postId, "comments"), orderBy("createdAt", "asc"), limit(30));
    const result = await getDocs(q);
    area.innerHTML = result.docs.map(item => {
      const comment = item.data();
      return `<div class="comment">${avatarHTML({ name: comment.authorName })}<div><b>${escapeHTML(comment.authorName || "Pessoa")}</b>${escapeHTML(comment.text || "")}</div></div>`;
    }).join("");
  } catch (error) {
    console.error("Comentários:", error);
  }
}

async function publishPost(event) {
  event.preventDefault();
  const text = $("#postText").value.trim();
  if (!text && !selectedImage) return toast("Escreva algo ou escolha uma foto.");

  const button = $("#publishButton");
  button.disabled = true;
  button.textContent = "Publicando...";

  try {
    let imageURL = "";
    if (selectedImage) {
      if (selectedImage.size > 5 * 1024 * 1024) throw new Error("A foto deve ter no máximo 5 MB.");
      const imageRef = ref(storage, `post-images/${currentUser.uid}/${Date.now()}-${selectedImage.name.replace(/[^a-zA-Z0-9.-]/g, "")}`);
      await uploadBytes(imageRef, selectedImage);
      imageURL = await getDownloadURL(imageRef);
    }

    await addDoc(collection(db, "posts"), {
      authorId: currentUser.uid,
      authorName: currentUserData.name || currentUser.displayName || "Pessoa Connect",
      authorUsername: currentUserData.username || "",
      authorPhoto: currentUserData.photoURL || "",
      text,
      imageURL,
      likesCount: 0,
      commentsCount: 0,
      likedBy: [],
      createdAt: serverTimestamp()
    });

    $("#postForm").reset();
    $("#postImagePreview").innerHTML = "";
    selectedImage = null;
    $("#postDialog").close();
    toast("Publicação realizada!");
  } catch (error) {
    console.error(error);
    toast(error.message || "Não foi possível publicar.");
  } finally {
    button.disabled = false;
    button.textContent = "Publicar";
  }
}

async function toggleLike(postElement) {
  const postId = postElement.dataset.postId;
  const postRef = doc(db, "posts", postId);
  const likeRef = doc(db, "posts", postId, "likes", currentUser.uid);

  try {
    const likeSnapshot = await getDoc(likeRef);
    if (likeSnapshot.exists()) {
      await deleteDoc(likeRef);
      await updateDoc(postRef, { likesCount: increment(-1) });
    } else {
      await setDoc(likeRef, {
        userId: currentUser.uid,
        createdAt: serverTimestamp()
      });
      await updateDoc(postRef, { likesCount: increment(1) });
    }
    await updateDoc(postRef, {
      likedBy: likeSnapshot.exists()
        ? (posts.find(p => p.id === postId)?.likedBy || []).filter(id => id !== currentUser.uid)
        : [...new Set([...(posts.find(p => p.id === postId)?.likedBy || []), currentUser.uid])]
    });
  } catch (error) {
    console.error(error);
    toast("Não foi possível registrar a curtida.");
  }
}

async function addComment(postElement, text) {
  const postId = postElement.dataset.postId;
  try {
    await addDoc(collection(db, "posts", postId, "comments"), {
      authorId: currentUser.uid,
      authorName: currentUserData.name || currentUser.displayName || "Pessoa Connect",
      text,
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, "posts", postId), { commentsCount: increment(1) });
    loadComments(postId);
  } catch (error) {
    console.error(error);
    toast("Não foi possível enviar o comentário.");
  }
}

async function deletePost(postElement) {
  if (!confirm("Deseja realmente excluir esta publicação?")) return;
  try {
    const postId = postElement.dataset.postId;
    const post = posts.find(item => item.id === postId);
    if (!post || post.authorId !== currentUser.uid) return toast("Você não pode excluir esta publicação.");
    await deleteDoc(doc(db, "posts", postId));
    toast("Publicação excluída.");
  } catch (error) {
    console.error(error);
    toast("Não foi possível excluir a publicação.");
  }
}

async function loadPeople(searchTerm = "") {
  const container = $("#searchResults");
  if (!container) return;
  const term = searchTerm.trim().toLowerCase();
  container.innerHTML = '<p class="muted">Buscando pessoas...</p>';
  try {
    const snapshot = await getDocs(query(collection(db, "users"), limit(60)));
    const people = snapshot.docs
      .map(item => ({ id: item.id, ...item.data() }))
      .filter(person => person.id !== currentUser.uid)
      .filter(person => !term || `${person.name || ""} ${person.username || ""}`.toLowerCase().includes(term));

    container.innerHTML = people.length ? people.map(person => `
      <div class="person-card">
        ${avatarHTML({ name: person.name, photoURL: person.photoURL })}
        <div class="person-info"><strong>${escapeHTML(person.name || "Pessoa Connect")}</strong><small>@${escapeHTML(person.username || "usuario")}</small></div>
        <button data-start-chat="${escapeHTML(person.id)}">Mensagem</button>
      </div>`).join("") : '<p class="muted">Nenhuma pessoa encontrada.</p>';
  } catch (error) {
    console.error(error);
    container.innerHTML = '<p class="muted">Não foi possível buscar pessoas. Verifique as regras do Firestore.</p>';
  }
}

async function startChat(otherUserId) {
  try {
    const chatsSnapshot = await getDocs(query(collection(db, "chats"), where("members", "array-contains", currentUser.uid)));
    let chat = chatsSnapshot.docs.find(item => item.data().members?.includes(otherUserId));
    if (!chat) {
      const other = await getUserData(otherUserId);
      const chatRef = await addDoc(collection(db, "chats"), {
        members: [currentUser.uid, otherUserId].sort(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        memberNames: {
          [currentUser.uid]: currentUserData.name || "Pessoa Connect",
          [otherUserId]: other.name || "Pessoa Connect"
        }
      });
      activeChatId = chatRef.id;
      activeChatUser = { id: otherUserId, ...other };
    } else {
      activeChatId = chat.id;
      activeChatUser = { id: otherUserId, ...(await getUserData(otherUserId)) };
    }
    showSection("messages");
    openChat();
    loadConversations();
  } catch (error) {
    console.error(error);
    toast("Não foi possível iniciar a conversa.");
  }
}

function openChat() {
  $("#chatEmpty").classList.add("hidden");
  $("#chatActive").classList.remove("hidden");
  $("#chatName").textContent = activeChatUser?.name || "Pessoa Connect";
  $("#chatUsername").textContent = "@" + (activeChatUser?.username || "usuario");
  $("#chatAvatar").textContent = (activeChatUser?.name || "C").charAt(0).toUpperCase();

  if (stopMessages) stopMessages();
  const q = query(collection(db, "chats", activeChatId, "messages"), orderBy("createdAt", "asc"), limit(100));
  stopMessages = onSnapshot(q, snapshot => {
    $("#chatMessages").innerHTML = snapshot.docs.map(item => {
      const message = item.data();
      return `<div class="chat-bubble ${message.senderId === currentUser.uid ? "mine" : ""}">${escapeHTML(message.text || "")}<small>${dateLabel(message.createdAt)}</small></div>`;
    }).join("");
    $("#chatMessages").scrollTop = $("#chatMessages").scrollHeight;
  }, error => {
    console.error(error);
    toast("Não foi possível carregar as mensagens.");
  });
}

async function loadConversations() {
  const container = $("#conversationList");
  if (!container) return;
  try {
    const snapshot = await getDocs(query(collection(db, "chats"), where("members", "array-contains", currentUser.uid), limit(50)));
    const chats = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    const entries = await Promise.all(chats.map(async chat => {
      const otherId = chat.members.find(id => id !== currentUser.uid);
      const user = await getUserData(otherId);
      return { chat, otherId, user };
    }));
    container.innerHTML = entries.length ? entries.map(({ chat, otherId, user }) => `
      <button class="conversation-item" data-chat-id="${escapeHTML(chat.id)}" data-user-id="${escapeHTML(otherId)}">
        ${avatarHTML({ name: user.name, photoURL: user.photoURL })}
        <span><strong>${escapeHTML(user.name || "Pessoa Connect")}</strong><small>@${escapeHTML(user.username || "usuario")}</small></span>
      </button>`).join("") : '<p class="muted">Você ainda não tem conversas. Explore pessoas para começar.</p>';
  } catch (error) {
    console.error(error);
    container.innerHTML = '<p class="muted">Não foi possível carregar as conversas.</p>';
  }
}

async function sendMessage(event) {
  event.preventDefault();
  const text = $("#messageInput").value.trim();
  if (!text || !activeChatId) return;
  const input = $("#messageInput");
  input.disabled = true;
  try {
    await addDoc(collection(db, "chats", activeChatId, "messages"), {
      senderId: currentUser.uid,
      text,
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, "chats", activeChatId), { updatedAt: serverTimestamp() });
    input.value = "";
  } catch (error) {
    console.error(error);
    toast("Não foi possível enviar a mensagem.");
  } finally {
    input.disabled = false;
    input.focus();
  }
}

async function loadNotifications() {
  const container = $("#notificationsList");
  if (!container) return;
  try {
    const q = query(collection(db, "users", currentUser.uid, "notifications"), orderBy("createdAt", "desc"), limit(40));
    if (stopNotifications) stopNotifications();
    stopNotifications = onSnapshot(q, snapshot => {
      $("#notificationBadge").style.display = snapshot.empty ? "none" : "block";
      container.innerHTML = snapshot.empty ? '<p class="muted">Você ainda não tem notificações.</p>' :
        snapshot.docs.map(item => {
          const notification = item.data();
          return `<div class="notification-item">${avatarHTML({ name: notification.fromName || "C" })}<div>${escapeHTML(notification.text || "Nova atividade na Connect")}<small>${dateLabel(notification.createdAt)}</small></div></div>`;
        }).join("");
    });
  } catch (error) {
    console.error(error);
    container.innerHTML = '<p class="muted">Não foi possível carregar as notificações.</p>';
  }
}

async function renderMyProfile() {
  const container = $("#profileContent");
  const name = currentUserData.name || currentUser.displayName || "Pessoa Connect";
  container.innerHTML = `
    <div class="profile-cover"></div>
    <div class="profile-heading">
      ${avatarHTML({ name, photoURL: currentUserData.photoURL })}
      <div><h2>${escapeHTML(name)}</h2><p>@${escapeHTML(currentUserData.username || "usuario")}</p></div>
    </div>
    <p class="profile-bio">${escapeHTML(currentUserData.bio || "Ainda não adicionou uma biografia.")}</p>
    <div class="profile-actions"><button class="primary-button" id="editProfileButton">Editar perfil</button></div>
    <h3 class="profile-posts-title">Minhas publicações</h3>
    <div class="posts-container" id="myPosts"></div>`;
  $("#editProfileButton").addEventListener("click", () => {
    $("#editName").value = currentUserData.name || "";
    $("#editUsername").value = currentUserData.username || "";
    $("#editBio").value = currentUserData.bio || "";
    $("#profileDialog").showModal();
  });
  const mine = posts.filter(post => post.authorId === currentUser.uid);
  $("#myPosts").innerHTML = mine.length ? mine.map(post => `
    <article class="post-card"><strong>${escapeHTML(name)}</strong><p class="post-text">${escapeHTML(post.text || "")}</p>${post.imageURL ? `<img class="post-image" src="${escapeHTML(post.imageURL)}" alt="">` : ""}</article>`).join("") : '<p class="muted">Você ainda não publicou nada.</p>';
}

async function saveProfile(event) {
  event.preventDefault();
  const name = $("#editName").value.trim();
  const username = $("#editUsername").value.trim().toLowerCase().replace(/[^a-z0-9_.]/g, "");
  const bio = $("#editBio").value.trim();
  if (!name || username.length < 3) return toast("Informe um nome e um usuário com pelo menos 3 caracteres.");
  try {
    await setDoc(doc(db, "users", currentUser.uid), { name, username, bio }, { merge: true });
    await updateProfile(currentUser, { displayName: name });
    currentUserData = { ...currentUserData, name, username, bio };
    updateIdentity();
    $("#profileDialog").close();
    renderMyProfile();
    toast("Perfil atualizado.");
  } catch (error) {
    console.error(error);
    toast("Não foi possível salvar o perfil. Confira as regras do Firestore.");
  }
}

async function startApplication(user) {
  currentUser = user;
  currentUserData = await getUserData(user.uid);
  if (!currentUserData.name) {
    currentUserData.name = user.displayName || user.email?.split("@")[0] || "Pessoa Connect";
    await setDoc(doc(db, "users", user.uid), {
      name: currentUserData.name,
      username: user.email?.split("@")[0] || "usuario",
      createdAt: serverTimestamp()
    }, { merge: true });
    currentUserData = await getUserData(user.uid);
  }
  updateIdentity();
  await loadFeed();
}

$("#logoutButton").addEventListener("click", async () => {
  await signOut(auth);
  location.href = "login.html";
});

$("#openComposer").addEventListener("click", openPostDialog);
$("#bannerCreate").addEventListener("click", openPostDialog);
$("#composerTrigger").addEventListener("click", openPostDialog);
$("#composerPhoto").addEventListener("click", openPostDialog);
$("#postForm").addEventListener("submit", publishPost);
$("#profileForm").addEventListener("submit", saveProfile);
$("#messageForm").addEventListener("submit", sendMessage);
$("#feedFilter").addEventListener("change", renderFeed);

$$("[data-close]").forEach(button => button.addEventListener("click", () => $("#" + button.dataset.close).close()));
$$(".nav-item").forEach(button => button.addEventListener("click", () => showSection(button.dataset.section)));
$$("[data-go]").forEach(button => button.addEventListener("click", () => showSection(button.dataset.go)));

$("#postImage").addEventListener("change", event => {
  selectedImage = event.target.files[0] || null;
  $("#postImagePreview").innerHTML = selectedImage ? `<img src="${URL.createObjectURL(selectedImage)}" alt="Prévia da foto">` : "";
});

$("#userSearchInput").addEventListener("input", event => {
  clearTimeout(window.searchDelay);
  window.searchDelay = setTimeout(() => loadPeople(event.target.value), 350);
});

$("#messageSearch").addEventListener("input", event => {
  const term = event.target.value.toLowerCase();
  $$(".conversation-item").forEach(item => item.style.display = item.textContent.toLowerCase().includes(term) ? "" : "none");
});

$("#searchResults").addEventListener("click", event => {
  const button = event.target.closest("[data-start-chat]");
  if (button) startChat(button.dataset.startChat);
});

$("#conversationList").addEventListener("click", async event => {
  const button = event.target.closest("[data-chat-id]");
  if (!button) return;
  activeChatId = button.dataset.chatId;
  activeChatUser = { id: button.dataset.userId, ...(await getUserData(button.dataset.userId)) };
  openChat();
});

$("#postsContainer").addEventListener("click", event => {
  const post = event.target.closest(".post-card");
  if (!post) return;
  if (event.target.closest(".like-button")) toggleLike(post);
  if (event.target.closest(".delete-post")) deletePost(post);
  if (event.target.closest(".comment-button")) post.querySelector(".comment-form input").focus();
  if (event.target.closest(".share-button")) {
    const url = `${location.origin}${location.pathname}#post-${post.dataset.postId}`;
    navigator.clipboard?.writeText(url).then(() => toast("Link copiado!")).catch(() => toast(url));
  }
});

$("#postsContainer").addEventListener("submit", event => {
  if (!event.target.matches(".comment-form")) return;
  event.preventDefault();
  const post = event.target.closest(".post-card");
  const input = event.target.elements.comment;
  const text = input.value.trim();
  if (text) addComment(post, text).then(() => input.value = "");
});

onAuthStateChanged(auth, user => {
  if (!user) {
    location.href = "login.html";
    return;
  }
  startApplication(user).catch(error => {
    console.error(error);
    toast("Erro ao iniciar a Connect. Confira a configuração do Firebase.");
  });
});
