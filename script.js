
import {
  auth,
  db,
  storage,
  onAuthStateChanged,
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  ref,
  uploadBytes,
  getDownloadURL
} from "./firebase-config.js";

const postsContainer = document.getElementById("postsContainer");
const postInput = document.getElementById("postInput");
const publishButton = document.getElementById("publishButton");
const photoInput = document.getElementById("photoInput");
const photoTool = document.getElementById("photoTool");
const imagePreview = document.getElementById("imagePreview");
const toast = document.getElementById("toast");
const searchInput = document.getElementById("searchInput");

let currentUser = null;
let currentUserData = {};
let selectedImage = null;
let postsCache = [];
let unsubscribePosts = null;
let currentFilter = "recentes";

function showToast(message) {
  if (!toast) {
    alert(message);
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function formatDate(timestamp) {
  if (!timestamp) return "agora mesmo";

  const date = timestamp.toDate
    ? timestamp.toDate()
    : new Date(timestamp);

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "agora mesmo";
  if (seconds < 3600) return `há ${Math.floor(seconds / 60)} minutos`;
  if (seconds < 86400) return `há ${Math.floor(seconds / 3600)} horas`;

  return date.toLocaleDateString("pt-BR");
}

function getAvatar(user) {
  return user?.photoURL ||
    user?.avatar ||
    "https://ui-avatars.com/api/?name=Connect&background=6956d8&color=fff";
}

async function loadCurrentUserData(user) {
  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);

  currentUserData = snapshot.exists() ? snapshot.data() : {};

  const name =
    currentUserData.name ||
    user.displayName ||
    user.email?.split("@")[0] ||
    "Usuário";

  const avatar = getAvatar({
    photoURL: currentUserData.photoURL || user.photoURL
  });

  document.querySelectorAll(".top-profile img, .top-profile .avatar").forEach(element => {
    if (element.tagName === "IMG") element.src = avatar;
  });

  document.querySelectorAll(".top-profile span:not(.chevron)").forEach(element => {
    element.textContent = name;
  });

  const welcome = document.querySelector(".welcome h1");

  if (welcome) {
    welcome.textContent = `Olá, ${name.split(" ")[0]}! ✦`;
  }

  return { name, avatar };
}

function requireLogin() {
  showToast("Entre na sua conta para usar essa função.");
  setTimeout(() => {
    window.location.href = "login.html";
  }, 900);
}

function renderPost(post) {
  const authorName = escapeHTML(post.authorName || "Usuário Connect");
  const username = escapeHTML(post.username || "usuario");
  const avatar = escapeHTML(post.authorAvatar || getAvatar({}));
  const text = escapeHTML(post.text || "");
  const image = post.imageURL
    ? `<img class="post-image" src="${escapeHTML(post.imageURL)}" alt="Imagem da publicação" loading="lazy">`
    : "";

  const liked = Array.isArray(post.likedBy)
    ? post.likedBy.includes(currentUser.uid)
    : false;

  const likes = Number(post.likesCount || 0);
  const comments = Number(post.commentsCount || 0);

  return `
    <article class="post card"
      data-post-id="${escapeHTML(post.id)}"
      data-likes="${likes}"
      data-created="${post.createdAt?.seconds || 0}">

      <div class="post-header">
        <img class="avatar" src="${avatar}" alt="${authorName}">
        <div class="post-author">
          <strong>${authorName}</strong>
          <span>@${username} · ${formatDate(post.createdAt)}</span>
        </div>
        <button type="button" class="more-button" aria-label="Opções da publicação">•••</button>
      </div>

      ${text ? `<p class="post-text">${text}</p>` : ""}
      ${image}

      <div class="post-stats">
        <span class="like-summary">♥ ${likes} curtidas</span>
        <span class="comment-count">${comments} comentários</span>
      </div>

      <div class="post-actions">
        <button type="button" class="action-button like-button ${liked ? "liked" : ""}">
          ${liked ? "♥" : "♡"} <span>${liked ? "Curtido" : "Curtir"}</span>
        </button>

        <button type="button" class="action-button comment-button">
          ♧ <span>Comentar</span>
        </button>

        <button type="button" class="action-button share-button">
          ↗ <span>Compartilhar</span>
        </button>
      </div>

      <div class="comments-area" hidden>
        <div class="comment-list"></div>

        <div class="comment-form">
          <input type="text" maxlength="500" placeholder="Escreva um comentário...">
          <button type="button">Enviar</button>
        </div>
      </div>
    </article>
  `;
}

function renderFeed(posts) {
  if (!postsContainer) return;

  const filtered = [...posts];

  if (currentFilter === "populares") {
    filtered.sort((a, b) =>
      Number(b.likesCount || 0) - Number(a.likesCount || 0)
    );
  } else {
    filtered.sort((a, b) => {
      const dateA = a.createdAt?.seconds || 0;
      const dateB = b.createdAt?.seconds || 0;
      return dateB - dateA;
    });
  }

  if (!filtered.length) {
    postsContainer.innerHTML = `
      <div class="card empty-feed">
        <h3>Seu feed está começando!</h3>
        <p>Seja a primeira pessoa a compartilhar uma publicação.</p>
      </div>
    `;
    return;
  }

  postsContainer.innerHTML = filtered.map(renderPost).join("");

  filtered.forEach(post => {
    loadComments(post.id);
  });
}

function listenToPosts() {
  if (unsubscribePosts) unsubscribePosts();

  const postsQuery = query(
    collection(db, "posts"),
    orderBy("createdAt", "desc"),
    limit(50)
  );

  unsubscribePosts = onSnapshot(
    postsQuery,
    snapshot => {
      postsCache = snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
      }));

      renderFeed(postsCache);
    },
    error => {
      console.error("Erro ao carregar publicações:", error);
      showToast("Não foi possível carregar o feed. Verifique as regras do Firebase.");
    }
  );
}

async function uploadPostImage(file) {
  if (!file) return "";

  if (!file.type.startsWith("image/")) {
    throw new Error("Escolha um arquivo de imagem válido.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("A imagem deve ter no máximo 5 MB.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `post-images/${currentUser.uid}/${Date.now()}.${extension}`;
  const imageRef = ref(storage, path);

  await uploadBytes(imageRef, file, {
    contentType: file.type
  });

  return await getDownloadURL(imageRef);
}

async function publishPost() {
  if (!currentUser) {
    requireLogin();
    return;
  }

  const text = postInput?.value.trim() || "";
  const file = photoInput?.files?.[0] || null;

  if (!text && !file) {
    showToast("Escreva algo ou escolha uma imagem.");
    return;
  }

  publishButton.disabled = true;
  publishButton.textContent = "Publicando...";

  try {
    let imageURL = "";

    if (file) {
      imageURL = await uploadPostImage(file);
    }

    const userInfo = await loadCurrentUserData(currentUser);

    const postData = {
      authorId: currentUser.uid,
      authorName: userInfo.name,
      username: currentUserData.username || currentUser.uid.slice(0, 8),
      authorAvatar: userInfo.avatar,
      text,
      imageURL,
      likesCount: 0,
      commentsCount: 0,
      likedBy: [],
      createdAt: serverTimestamp()
    };

    await addDoc(collection(db, "posts"), postData);

    if (postInput) postInput.value = "";
    if (photoInput) photoInput.value = "";
    if (imagePreview) imagePreview.innerHTML = "";

    selectedImage = null;

    showToast("Publicação enviada com sucesso!");
  } catch (error) {
    console.error("Erro ao publicar:", error);
    showToast(error.message || "Não foi possível publicar.");
  } finally {
    publishButton.disabled = false;
    publishButton.textContent = "Publicar";
  }
}

async function toggleLike(postId, button) {
  if (!currentUser) {
    requireLogin();
    return;
  }

  const likeRef = doc(db, "posts", postId, "likes", currentUser.uid);
  const postRef = doc(db, "posts", postId);

  try {
    const likeSnapshot = await getDoc(likeRef);

    if (likeSnapshot.exists()) {
      await deleteDoc(likeRef);
    } else {
      await setDoc(likeRef, {
        userId: currentUser.uid,
        createdAt: serverTimestamp()
      });
    }

    const postSnapshot = await getDoc(postRef);

    if (postSnapshot.exists()) {
      const likesSnapshot = await getDocs(
        collection(db, "posts", postId, "likes")
      );

      await setDoc(postRef, {
        likesCount: likesSnapshot.size
      }, { merge: true });
    }
  } catch (error) {
    console.error("Erro ao curtir:", error);
    showToast("Não foi possível registrar sua curtida.");
  }
}

async function loadComments(postId) {
  const post = postsContainer.querySelector(
    `[data-post-id="${CSS.escape(postId)}"]`
  );

  if (!post) return;

  const list = post.querySelector(".comment-list");
  if (!list) return;

  try {
    const commentsQuery = query(
      collection(db, "posts", postId, "comments"),
      orderBy("createdAt", "asc"),
      limit(50)
    );

    const snapshot = await getDocs(commentsQuery);

    list.innerHTML = snapshot.docs.map(item => {
      const comment = item.data();

      return `
        <div class="sample-comment">
          <strong>${escapeHTML(comment.authorName || "Usuário")}:</strong>
          ${escapeHTML(comment.text || "")}
        </div>
      `;
    }).join("");
  } catch (error) {
    console.error("Erro ao carregar comentários:", error);
  }
}

async function sendComment(postId, input) {
  if (!currentUser) {
    requireLogin();
    return;
  }

  const text = input.value.trim();

  if (!text) {
    showToast("Digite um comentário.");
    return;
  }

  try {
    const userInfo = await loadCurrentUserData(currentUser);

    await addDoc(
      collection(db, "posts", postId, "comments"),
      {
        authorId: currentUser.uid,
        authorName: userInfo.name,
        text,
        createdAt: serverTimestamp()
      }
    );

    const postRef = doc(db, "posts", postId);
    const postSnapshot = await getDoc(postRef);

    if (postSnapshot.exists()) {
      const commentsSnapshot = await getDocs(
        collection(db, "posts", postId, "comments")
      );

      await setDoc(postRef, {
        commentsCount: commentsSnapshot.size
      }, { merge: true });
    }

    input.value = "";
    showToast("Comentário publicado!");
  } catch (error) {
    console.error("Erro ao comentar:", error);
    showToast("Não foi possível enviar o comentário.");
  }
}

function preparePhotoInput() {
  if (!photoTool || !photoInput) return;

  photoTool.addEventListener("click", () => {
    photoInput.click();
  });

  photoInput.addEventListener("change", () => {
    const file = photoInput.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Escolha uma imagem válida.");
      photoInput.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast("A imagem deve ter no máximo 5 MB.");
      photoInput.value = "";
      return;
    }

    selectedImage = file;

    const reader = new FileReader();

    reader.onload = event => {
      imagePreview.innerHTML = `
        <div class="preview-wrap">
          <img src="${event.target.result}" alt="Prévia da imagem">
          <button type="button" id="removePreview" class="remove-preview">
            Remover foto ×
          </button>
        </div>
      `;

      document.getElementById("removePreview").addEventListener("click", () => {
        selectedImage = null;
        photoInput.value = "";
        imagePreview.innerHTML = "";
      });
    };

    reader.readAsDataURL(file);
  });
}

function prepareFeedActions() {
  if (!postsContainer) return;

  postsContainer.addEventListener("click", async event => {
    const button = event.target.closest("button");
    const post = event.target.closest(".post");

    if (!post) return;

    const postId = post.dataset.postId;

    if (button?.classList.contains("like-button")) {
      await toggleLike(postId, button);
    }

    if (button?.classList.contains("comment-button")) {
      const area = post.querySelector(".comments-area");

      area.hidden = !area.hidden;

      if (!area.hidden) {
        area.querySelector("input")?.focus();
        loadComments(postId);
      }
    }

    if (button?.closest(".comment-form")) {
      const input = post.querySelector(".comment-form input");
      await sendComment(postId, input);
    }

    if (button?.classList.contains("share-button")) {
      const url = `${window.location.origin}${window.location.pathname}#post-${postId}`;

      try {
        if (navigator.share) {
          await navigator.share({
            title: "Connect",
            text: "Confira esta publicação!",
            url
          });
        } else {
          await navigator.clipboard.writeText(url);
          showToast("Link copiado!");
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          showToast("Não foi possível compartilhar.");
        }
      }
    }

    if (button?.classList.contains("more-button")) {
      if (post.dataset.authorId !== currentUser?.uid) {
        showToast("Você só pode administrar suas próprias publicações.");
        return;
      }

      const confirmDelete = confirm("Deseja excluir esta publicação?");

      if (confirmDelete) {
        try {
          await deleteDoc(doc(db, "posts", postId));
          showToast("Publicação excluída.");
        } catch (error) {
          console.error(error);
          showToast("Não foi possível excluir a publicação.");
        }
      }
    }
  });

  postsContainer.addEventListener("keydown", event => {
    if (
      event.key === "Enter" &&
      event.target.matches(".comment-form input")
    ) {
      event.preventDefault();
      event.target.closest(".comment-form")
        .querySelector("button")
        .click();
    }
  });
}

function prepareSearch() {
  if (!searchInput) return;

  searchInput.addEventListener("input", () => {
    const term = searchInput.value.trim().toLocaleLowerCase("pt-BR");

    const filtered = postsCache.filter(post => {
      const text = `${post.text || ""} ${post.authorName || ""} ${post.username || ""}`;
      return text.toLocaleLowerCase("pt-BR").includes(term);
    });

    renderFeed(filtered);
  });
}

function prepareFilter() {
  const filter = document.getElementById("feedFilter");

  if (!filter) return;

  filter.addEventListener("change", () => {
    currentFilter = filter.value;
    renderFeed(postsCache);
  });
}

function preparePublish() {
  if (!publishButton) return;

  publishButton.addEventListener("click", publishPost);
}

function prepareNavigation() {
  document.getElementById("jumpToPost")?.addEventListener("click", () => {
    document.getElementById("criar-publicacao")?.scrollIntoView({
      behavior: "smooth"
    });

    postInput?.focus();
  });

  document.querySelectorAll('a[href="#criar-publicacao"]').forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();

      document.getElementById("criar-publicacao")?.scrollIntoView({
        behavior: "smooth"
      });

      postInput?.focus();
    });
  });

  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", event => {
      const section = link.dataset.nav;

      if (section === "inicio") {
        event.preventDefault();
        renderFeed(postsCache);
      }

      if (section === "mensagens") {
        event.preventDefault();
        showToast("A área de mensagens será conectada no próximo arquivo.");
      }

      if (section === "notificacoes") {
        event.preventDefault();
        showToast("A área de notificações será conectada em seguida.");
      }
    });
  });
}

function startApplication(user) {
  currentUser = user;

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  loadCurrentUserData(user)
    .then(() => {
      listenToPosts();
    })
    .catch(error => {
      console.error("Erro ao iniciar perfil:", error);
      showToast("Não foi possível carregar seu perfil.");
    });
}

function initialize() {
  if (!postsContainer) {
    console.error("Elemento #postsContainer não encontrado.");
    return;
  }

  preparePhotoInput();
  prepareFeedActions();
  preparePublish();
  prepareSearch();
  prepareFilter();
  prepareNavigation();

  onAuthStateChanged(auth, user => {
    startApplication(user);
  });
}

initialize();
