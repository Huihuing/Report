/* Fridge Chef — client-only UI; user entries are never sent to a server. */
(function () {
  "use strict";
  const L = globalThis.FridgeLogic;
  const RECIPES = globalThis.FridgeRecipes;
  const STORAGE_KEY = "fridge-chef:ingredients:v1";
  if (!L || !Array.isArray(RECIPES)) {
    document.addEventListener("DOMContentLoaded", () => {
      const el = document.getElementById("input-feedback");
      if (el) el.textContent = "앱을 불러오지 못했어요. 페이지를 새로고침해 주세요.";
    });
    return;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const $ = id => document.getElementById(id);
    const form = $("ingredient-form");
    const input = $("ingredient-input");
    const feedback = $("input-feedback");
    const quick = $("quick-tags");
    const ingredientList = $("ingredient-list");
    const recipeGrid = $("recipe-grid");
    const search = $("recipe-search");
    const filters = [...document.querySelectorAll("[data-filter]")];
    const quickNames = ["달걀", "밥", "김치", "양파", "두부", "감자", "대파", "치즈", "우유", "식빵", "토마토", "참치캔"];
    let ingredients = [];
    let activeFilter = "all";

    function node(tag, className, text) {
      const element = document.createElement(tag);
      if (className) element.className = className;
      if (text !== undefined) element.textContent = String(text);
      return element;
    }

    function setMessage(message, success = false) {
      feedback.textContent = message;
      feedback.classList.toggle("success", success);
    }

    function readStorage() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) throw new Error("Invalid saved data");
        return L.sanitizeIngredientList(parsed);
      } catch (err) {
        setMessage("저장된 재료를 읽지 못했어요. 새로 등록하면 복구를 시도해요.");
        return [];
      }
    }

    function saveStorage() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ingredients));
        return true;
      } catch (err) {
        setMessage("저장 공간을 사용할 수 없어 새로고침하면 재료가 사라질 수 있어요.");
        return false;
      }
    }

    function appendTag(parent, text, missing) {
      parent.append(node("span", "small-tag" + (missing ? " missing" : ""), text));
    }

    function addName(raw) {
      const result = L.addIngredient(ingredients, raw);
      if (!result.added) {
        setMessage(result.error);
        return;
      }
      ingredients = result.ingredients;
      const saved = saveStorage();
      if (saved) setMessage(result.name + "을(를) 추가했어요.", true);
      input.value = "";
      render();
    }

    function renderQuick() {
      quick.replaceChildren();
      for (const name of quickNames) {
        const added = ingredients.includes(L.normalizeName(name));
        const btn = node("button", added ? "added" : "", added ? "✓ " + name : "+ " + name);
        btn.type = "button";
        btn.disabled = added;
        btn.setAttribute("aria-label", added ? name + " 등록됨" : name + " 빠른 추가");
        btn.addEventListener("click", () => addName(name));
        quick.append(btn);
      }
    }

    function renderPantry() {
      ingredientList.replaceChildren();
      $("pantry-counter").textContent = ingredients.length + "개";
      $("pantry-empty").hidden = ingredients.length !== 0;
      $("clear-all").hidden = ingredients.length === 0;
      $("stat-count").textContent = String(ingredients.length);

      for (const name of ingredients) {
        const pill = node("div", "ingredient-pill");
        pill.append(node("span", "", name));
        const remove = node("button", "", "×");
        remove.type = "button";
        remove.title = name + " 삭제";
        remove.setAttribute("aria-label", name + " 삭제");
        remove.addEventListener("click", () => {
          ingredients = L.removeIngredient(ingredients, name);
          const saved = saveStorage();
          if (saved) setMessage(name + "을(를) 삭제했어요.", true);
          render();
        });
        pill.append(remove);
        ingredientList.append(pill);
      }
    }

    function recipeCard(recipe) {
      const card = node("article", "recipe-card");
      const top = node("div", "recipe-top");
      const emoji = node("div", "recipe-emoji", recipe.emoji);
      emoji.setAttribute("aria-hidden", "true");
      const nameArea = node("div", "recipe-name");
      nameArea.append(node("h3", "", recipe.name));
      const meta = node("div", "recipe-meta");
      meta.append(node("span", "", recipe.category), node("span", "", "약 " + recipe.minutes + "분"));
      nameArea.append(meta);
      const badge = node("span", "match-status" + (recipe.ready ? "" : " missing"), recipe.ready ? "기본 재료 있음" : "재료 " + recipe.missing.length + "개 부족");
      top.append(emoji, nameArea, badge);
      card.append(top);

      const progress = node("div", "match-track");
      progress.setAttribute("role", "progressbar");
      progress.setAttribute("aria-label", recipe.name + " 기본 재료 일치도");
      progress.setAttribute("aria-valuemin", "0");
      progress.setAttribute("aria-valuemax", "100");
      progress.setAttribute("aria-valuenow", String(Math.round(recipe.ratio * 100)));
      const progressFill = node("span");
      progressFill.style.width = Math.round(recipe.ratio * 100) + "%";
      progress.append(progressFill);
      const matchLabel = node("div", "recipe-match-label");
      matchLabel.append(node("span", "", "재료 일치도"), node("b", "", Math.round(recipe.ratio * 100) + "%"));
      card.append(progress, matchLabel);

      const owned = node("div", "ingredient-section");
      owned.append(node("b", "", "✓ 보유한 재료"));
      const ownedTags = node("div", "small-tags");
      for (const item of recipe.matched) appendTag(ownedTags, item, false);
      if (!recipe.matched.length) ownedTags.append(node("span", "", "아직 없어요"));
      owned.append(ownedTags);
      card.append(owned);

      const missing = node("div", "ingredient-section");
      missing.append(node("b", "", "＋ 더 필요한 재료"));
      const missingTags = node("div", "small-tags");
      for (const item of recipe.missing) appendTag(missingTags, item, true);
      if (!recipe.missing.length) missingTags.append(node("span", "", "기본 재료를 모두 갖췄어요!"));
      missing.append(missingTags);
      card.append(missing);
      const details = node("details", "cooking-details");
      const toggle = node("summary", "cooking-toggle", "단계별 조리법 보기");
      details.append(toggle);
      const list = node("ol", "cooking-step-list");
      const steps = globalThis.FridgeCookingSteps && globalThis.FridgeCookingSteps[recipe.id];
      const items = Array.isArray(steps) && steps.length >= 3 ? steps : [recipe.steps];
      for (const instruction of items) {
        list.append(node("li", "", instruction));
      }
      details.append(list);
      const note = node("p", "cooking-caution", "※ 간소화한 조리 예시예요. 양념·수량·위생·알레르기·충분한 익힘은 직접 확인해 주세요.");
      details.append(note);
      card.append(details);
      return card;
    }

    function renderRecipes() {
      recipeGrid.replaceChildren();
      const ranked = L.rankRecipes(ingredients, RECIPES);
      const ready = ingredients.length ? ranked.filter(r => r.ready).length : 0;
      $("stat-recipes").textContent = String(RECIPES.length);
      $("stat-ready").textContent = String(ready);
      $("ready-count").textContent = String(ready);

      const term = search.value.trim().normalize("NFC").toLocaleLowerCase("ko");
      let shown = ingredients.length ? ranked.filter(r => r.matched.length > 0) : [];
      if (activeFilter === "ready") shown = shown.filter(r => r.ready);
      if (term) shown = shown.filter(r => r.name.toLocaleLowerCase("ko").includes(term));
      $("results-label").textContent = ingredients.length === 0
        ? "냉장고에 재료를 넣으면 맞춤 요리가 표시돼요."
        : "조건에 맞는 요리 " + shown.length + "개" + (activeFilter === "ready" ? " · 기본 재료가 모두 있는 후보" : " · 일치도순");
      $("recipe-empty").hidden = shown.length > 0;
      const empty = $("recipe-empty");
      const message = empty.querySelector("p");
      if (message) message.textContent = ingredients.length === 0
        ? "왼쪽에서 식재료를 추가하면 추천이 시작돼요."
        : activeFilter === "ready" ? "재료를 더 추가하거나 전체 요리로 전환해 보세요."
        : "다른 재료를 추가하거나 검색어를 바꿔 보세요.";
      for (const recipe of shown) recipeGrid.append(recipeCard(recipe));
    }

    function render() {
      renderQuick();
      renderPantry();
      renderRecipes();
    }

    form.addEventListener("submit", event => {
      event.preventDefault();
      addName(input.value);
      input.focus();
    });

    $("clear-all").addEventListener("click", () => {
      if (!window.confirm("등록된 재료 " + ingredients.length + "개를 모두 삭제할까요?")) return;
      ingredients = [];
      const saved = saveStorage();
      if (saved) setMessage("냉장고를 비웠어요.", true);
      render();
    });

    for (const btn of filters) btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter;
      for (const other of filters) {
        const selected = other === btn;
        other.classList.toggle("active", selected);
        other.setAttribute("aria-pressed", String(selected));
      }
      renderRecipes();
    });
    search.addEventListener("input", renderRecipes);
    ingredients = readStorage();
    render();
  });
})();
