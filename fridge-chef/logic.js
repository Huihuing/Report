/* Pure matching helpers. Shared by browser and Node tests. */
(function (root) {
  "use strict";
  const MAX_NAME_LENGTH = 24;
  const MAX_INGREDIENTS = 40;
  const aliases = Object.freeze({
    "계란": "달걀", "계란흰자": "달걀흰자",
    "파프리카": "파프리카", "파스타": "파스타면",
    "스파게티면": "파스타면", "스파게티": "파스타면",
    "참치": "참치캔", "캔참치": "참치캔", "통조림참치": "참치캔",
    "토마토 소스": "토마토소스", "부침 가루": "부침가루",
    "대파": "대파", "소고기": "소고기", "쇠고기": "소고기",
    "고구마": "고구마", "양배추": "양배추", "두부": "두부",
    "김치": "김치", "달걀": "달걀", "밥": "밥"
  });

  function normalizeName(value) {
    if (typeof value !== "string") return "";
    const clean = value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ko");
    return aliases[clean] || clean;
  }

  function validateName(raw) {
    if (typeof raw !== "string" || !raw.trim()) return "재료 이름을 입력해 주세요.";
    const normal = normalizeName(raw);
    if (Array.from(normal).length > MAX_NAME_LENGTH) return "재료 이름은 24자 이내로 입력해 주세요.";
    if (!/^[\p{L}\p{N} \-()]+$/u.test(normal)) return "재료 이름에 문자·숫자·공백만 사용해 주세요.";
    return "";
  }

  function sanitizeIngredientList(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const normalized = [];
    for (const raw of list) {
      const name = normalizeName(raw);
      if (validateName(name) || seen.has(name)) continue;
      seen.add(name);
      normalized.push(name);
      if (normalized.length >= MAX_INGREDIENTS) break;
    }
    return normalized;
  }

  function addIngredient(current, raw) {
    const ingredients = sanitizeIngredientList(current);
    const error = validateName(raw);
    if (error) return { ingredients, added: false, error };
    const name = normalizeName(raw);
    if (ingredients.includes(name)) return { ingredients, added: false, error: "이미 냉장고에 있는 재료예요." };
    if (ingredients.length >= MAX_INGREDIENTS) return { ingredients, added: false, error: "재료는 최대 40개까지 등록할 수 있어요." };
    return { ingredients: ingredients.concat(name), added: true, name, error: "" };
  }

  function removeIngredient(current, raw) {
    const name = normalizeName(raw);
    return sanitizeIngredientList(current).filter(item => item !== name);
  }

  function matchRecipe(recipe, ingredientList) {
    const available = new Set(sanitizeIngredientList(ingredientList));
    const required = [...new Set((Array.isArray(recipe.ingredients) ? recipe.ingredients : []).map(normalizeName).filter(Boolean))];
    const matched = required.filter(name => available.has(name));
    const missing = required.filter(name => !available.has(name));
    const ratio = required.length > 0 ? matched.length / required.length : 0;
    return { ...recipe, matched, missing, ratio, ready: required.length > 0 && missing.length === 0 };
  }

  function rankRecipes(ingredientList, recipes) {
    if (!Array.isArray(recipes)) return [];
    const available = sanitizeIngredientList(ingredientList);
    return recipes.map(recipe => matchRecipe(recipe, available))
      .sort((a,b) => b.ratio - a.ratio
        || b.matched.length - a.matched.length
        || a.missing.length - b.missing.length
        || a.name.localeCompare(b.name, "ko"));
  }

  const api = Object.freeze({ MAX_NAME_LENGTH, MAX_INGREDIENTS, normalizeName, validateName, sanitizeIngredientList, addIngredient, removeIngredient, matchRecipe, rankRecipes });
  root.FridgeLogic = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
