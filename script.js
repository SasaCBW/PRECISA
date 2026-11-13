
document.addEventListener("DOMContentLoaded", () => {

  // Ano automático
  const year = document.getElementById("currentYear");

  if (year) {
    year.textContent = new Date().getFullYear();
  }

  // Menu para celulares
  const menuToggle = document.getElementById("menuToggle");
  const navigation = document.getElementById("navigation");

  menuToggle?.addEventListener("click", () => {
    navigation.classList.toggle("active");

    menuToggle.textContent =
      navigation.classList.contains("active") ? "✕" : "☰";
  });

  navigation?.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      navigation.classList.remove("active");
      menuToggle.textContent = "☰";
    });
  });

  // Pesquisa de categorias
  const searchInput = document.getElementById("mainSearch");
  const searchButton = document.getElementById("searchButton");
  const cards = document.querySelectorAll(".category-card");
  const noResults = document.getElementById("noResults");

  function searchCategories() {
    const term = searchInput.value
      .trim()
      .toLocaleLowerCase("pt-BR");

    let visible = 0;

    cards.forEach(card => {
      const content = (
        card.innerText + " " +
        card.dataset.category
      ).toLocaleLowerCase("pt-BR");

      const matches = content.includes(term);

      card.style.display = matches ? "" : "none";

      if (matches) visible++;
    });

    noResults.hidden = visible !== 0;

    if (term !== "") {
      document.querySelector(".categories-section")
        .scrollIntoView({ behavior: "smooth" });
    }
  }

  searchButton?.addEventListener("click", searchCategories);

  searchInput?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      searchCategories();
    }
  });

  searchInput?.addEventListener("input", () => {
    if (!searchInput.value.trim()) {
      cards.forEach(card => card.style.display = "");
      noResults.hidden = true;
    }
  });

  // Pesquisas rápidas
  document.querySelectorAll(".search-tag").forEach(tag => {
    tag.addEventListener("click", () => {
      searchInput.value = tag.dataset.search;
      searchCategories();
    });
  });

  // Calculadora financeira
  const incomeInput = document.getElementById("income");
  const expensesInput = document.getElementById("expenses");
  const calculateButton = document.getElementById("calculateButton");

  const balance = document.getElementById("balance");
  const balanceMessage = document.getElementById("balanceMessage");

  const currency = value => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  };

  calculateButton?.addEventListener("click", () => {
    const income = Number(incomeInput.value);
    const expenses = Number(expensesInput.value);

    if (
      incomeInput.value === "" ||
      expensesInput.value === "" ||
      !Number.isFinite(income) ||
      !Number.isFinite(expenses) ||
      income < 0 ||
      expenses < 0
    ) {
      balance.textContent = "Valores inválidos";
      balanceMessage.textContent =
        "Informe valores válidos nos dois campos.";
      return;
    }

    const result = income - expenses;

    balance.textContent = currency(result);

    if (result > 0) {
      balanceMessage.textContent =
        "Seu orçamento apresenta saldo positivo de " +
        currency(result) + ".";
    } else if (result < 0) {
      balanceMessage.textContent =
        "Suas despesas superam sua renda em " +
        currency(Math.abs(result)) + ".";
    } else {
      balanceMessage.textContent =
        "Sua renda e suas despesas estão iguais.";
    }

    balance.style.color =
      result >= 0 ? "#47d6a1" : "#ff8b8b";
  });

});
