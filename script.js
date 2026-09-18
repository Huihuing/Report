const root = document.documentElement;
const themeButton = document.querySelector(".theme-toggle");
const themeLabel = document.querySelector(".theme-label");
const filters = [...document.querySelectorAll(".filter")];
const projects = [...document.querySelectorAll(".project-card")];

const savedTheme = localStorage.getItem("theme");
const preferredDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const initialTheme = savedTheme || (preferredDark ? "dark" : "light");

function applyTheme(theme) {
  root.dataset.theme = theme;
  const isDark = theme === "dark";
  themeButton.setAttribute("aria-pressed", String(isDark));
  themeLabel.textContent = isDark ? "Light" : "Dark";
}

applyTheme(initialTheme);

themeButton.addEventListener("click", () => {
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem("theme", next);
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

document.querySelector("#year").textContent = new Date().getFullYear();
