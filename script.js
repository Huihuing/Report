const root = document.documentElement;
const themeButton = document.querySelector(".theme-toggle");
const themeLabel = document.querySelector(".theme-label");
const motionButton = document.querySelector(".motion-toggle");
const motionLabel = document.querySelector(".motion-label");
const filters = [...document.querySelectorAll(".filter")];
const projects = [...document.querySelectorAll(".project-card")];

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    // 저장소 접근이 제한돼도 화면 기능은 계속 동작합니다.
  }
}

const preferredDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const initialTheme = safeStorageGet("theme") || (preferredDark ? "dark" : "light");
const initialMotion = safeStorageGet("motion") || (prefersReduced ? "reduced" : "full");

function applyTheme(theme) {
  root.dataset.theme = theme;
  const isDark = theme === "dark";
  themeButton.setAttribute("aria-pressed", String(isDark));
  themeLabel.textContent = isDark ? "Light" : "Dark";
}

function applyMotion(mode) {
  root.dataset.motion = mode;
  const reduced = mode === "reduced";
  motionButton.setAttribute("aria-pressed", String(reduced));
  motionLabel.textContent = reduced ? "Reduced" : "Motion";
}

applyTheme(initialTheme);
applyMotion(initialMotion);

themeButton.addEventListener("click", () => {
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  safeStorageSet("theme", next);
});

motionButton.addEventListener("click", () => {
  const next = root.dataset.motion === "reduced" ? "full" : "reduced";
  applyMotion(next);
  safeStorageSet("motion", next);
});

filters.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;

    filters.forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });

    projects.forEach((project) => {
      const categories = project.dataset.category.split(" ");
      project.hidden = filter !== "all" && !categories.includes(filter);
    });
  });
});

const year = document.querySelector("#year");
if (year) {
  year.textContent = new Date().getFullYear();
}
