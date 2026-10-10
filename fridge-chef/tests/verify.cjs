#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const L = require("../logic.js");
require("../recipes.js");
require("../cooking-steps.js");
const cookingSteps = globalThis.FridgeCookingSteps;
const R = globalThis.FridgeRecipes;
let checks = 0;
function verify(condition, description) {
  checks++;
  assert.ok(condition, description);
}

verify(Array.isArray(R) && R.length >= 20, "20 or more example recipes");
verify(new Set(R.map(r => r.id)).size === R.length, "unique recipe IDs");
verify(new Set(R.map(r => r.name)).size === R.length, "unique recipe names");
for (const r of R) {
  verify(typeof r.id === "string" && r.id.length > 0, "valid ID: " + r.name);
  verify(typeof r.name === "string" && r.name.length > 0, "valid recipe name: " + r.id);
  verify(Number.isInteger(r.minutes) && r.minutes > 0, "time: " + r.name);
  verify(Array.isArray(r.ingredients) && r.ingredients.length > 0, "ingredients: " + r.name);
  verify(new Set(r.ingredients.map(L.normalizeName)).size === r.ingredients.length, "no duplicate required ingredients: " + r.name);
  verify(r.ingredients.every(x => L.validateName(x) === ""), "valid ingredients: " + r.name);
  verify(typeof r.steps === "string" && r.steps.length > 0, "steps: " + r.name);
  const instructions = cookingSteps[r.id];
  verify(Array.isArray(instructions) && instructions.length >= 3, "detailed instructions: " + r.name);
  verify(instructions.every(step => typeof step === "string" && step.trim().length >= 10), "meaningful steps: " + r.name);
  verify(!instructions.some(step => /<[^>]*>/.test(step)), "no markup in steps: " + r.name);
}
let state = L.addIngredient([], " 계란 ");
verify(state.added && state.name === "달걀", "egg alias");
verify(state.ingredients[0] === "달걀", "canonical pantry");
state = L.addIngredient(state.ingredients, "달걀");
verify(!state.added && state.ingredients.length === 1, "same ingredient cannot be added twice");
verify(!L.addIngredient([], " ").added, "blank rejected");
verify(!L.addIngredient([], "<img>").added, "markup rejected");
verify(!L.addIngredient([], "가".repeat(25)).added, "length limit");
verify(!L.addIngredient(Array.from({ length: 40 }, (_, i) => "재료" + i), "새 재료").added, "pantry count limit");
verify(L.sanitizeIngredientList(["계란", "달걀", {}, null, "밥"]).join(",") === "달걀,밥", "restore messy saved data");
verify(L.removeIngredient(["달걀", "밥"], "계란").join(",") === "밥", "delete by alias");
verify(L.normalizeName("스파게티면") === "파스타면", "pasta alias");
verify(L.normalizeName("참치") === "참치캔", "canned tuna alias");
const dish = R.find(r => r.name === "간장계란밥");
verify(!!dish, "reference dish exists");
let match = L.matchRecipe(dish, ["밥", "계란"]);
verify(match.ready && match.ratio === 1, "all ingredients available");
verify(match.matched.length === 2 && match.missing.length === 0, "matched set");
match = L.matchRecipe(dish, ["밥"]);
verify(!match.ready && match.ratio === 0.5, "partial match");
verify(match.missing.length === 1 && match.missing[0] === "달걀", "missing ingredient");
verify(L.matchRecipe(dish, []).ratio === 0, "empty pantry");
const ranked = L.rankRecipes(["밥", "계란"], R);
verify(ranked.length === R.length, "no lost recipes");
verify(ranked.every((r, i) => i === 0 || ranked[i - 1].ratio >= r.ratio), "descending accuracy");
verify(L.rankRecipes([], R).every(r => !r.ready && r.ratio === 0), "no false ready recipes");
verify(L.rankRecipes(["없는재료"], R).every(r => r.matched.length === 0), "unrecognized ingredient does not invent matches");
verify(ranked[0].ratio === 1, "best match first");
verify(L.rankRecipes(["밥", "계란"], R).length === R.length, "stable repeated calls");
verify(L.matchRecipe(dish, ["밥", "밥", "달걀"]).matched.length === 2, "duplicate pantry items do not alter count");

console.log("PASS " + checks + " assertions across " + R.length + " sample recipes");
