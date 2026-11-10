import { state } from "./state.js";
import { icons } from "./shared.js";
import {
  addPane,
  openOutputForInput,
  updateMobile,
  captureWorkspace,
  restoreWorkspace,
} from "./workspace.js";
import { parseInput } from "./input-pane.js";
import { encodeShareState, decodeShareState } from "./share-state.js";

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const button = document.getElementById("theme-toggle");
  button.innerHTML = theme === "light" ? icons.moon : icons.sun;
  button.setAttribute(
    "aria-label",
    `Switch to ${theme === "light" ? "dark" : "light"} theme`,
  );
  localStorage.setItem("ast-cpp-theme", theme);
}

document.getElementById("theme-toggle").addEventListener("click", () => {
  setTheme(
    document.documentElement.dataset.theme === "light" ? "dark" : "light",
  );
});
document.getElementById("add-input").addEventListener("click", () => addPane());
document.getElementById("reset-ui").addEventListener("click", () => {
  const url = new URL(location.href);
  url.searchParams.delete("s");
  location.assign(url.href);
});

const shareButton = document.getElementById("share-button");
const sharePanel = document.getElementById("share-panel");
const shareUrl = document.getElementById("share-url");
const shareStatus = document.getElementById("share-status");
async function copyShareLink() {
  try {
    await navigator.clipboard.writeText(shareUrl.value);
    shareStatus.textContent = "Link copied";
  } catch {
    shareUrl.focus();
    shareUrl.select();
    shareStatus.textContent = "Select and copy the link";
  }
}
shareButton.addEventListener("click", async () => {
  if (!sharePanel.hidden) {
    sharePanel.hidden = true;
    shareButton.setAttribute("aria-expanded", "false");
    return;
  }
  sharePanel.hidden = false;
  shareButton.setAttribute("aria-expanded", "true");
  try {
    const url = new URL(location.href);
    url.searchParams.set("s", encodeShareState(captureWorkspace()));
    history.replaceState(null, "", url);
    shareUrl.value = url.href;
    await copyShareLink();
    if (url.href.length > 8000)
      shareStatus.textContent += " · Long links may not work in every app";
  } catch (error) {
    shareStatus.textContent = error.message;
    shareUrl.value = "";
  }
});
document
  .getElementById("copy-share-url")
  .addEventListener("click", copyShareLink);
document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest(".share-menu")) {
    sharePanel.hidden = true;
    shareButton.setAttribute("aria-expanded", "false");
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    sharePanel.hidden = true;
    shareButton.setAttribute("aria-expanded", "false");
  }
});

setTheme(localStorage.getItem("ast-cpp-theme") || "dark");
let restored = false;
const token = new URL(location.href).searchParams.get("s");
if (token) {
  try {
    restoreWorkspace(decodeShareState(token));
    restored = true;
  } catch (error) {
    sharePanel.hidden = false;
    shareButton.setAttribute("aria-expanded", "true");
    shareStatus.textContent = `Could not restore link: ${error.message}`;
  }
}
if (!restored) {
  const initialInput = addPane();
  openOutputForInput(initialInput.id);
  fetch(`${import.meta.env.BASE_URL}examples/assert-ast.txt`)
    .then((response) => response.text())
    .then((value) => {
      initialInput.textarea.value = value;
      parseInput(initialInput);
      state.activeMobileId = initialInput.id;
      updateMobile();
    })
    .catch((error) => {
      initialInput.body.querySelector(".input-status").textContent =
        `Could not load example: ${error.message}`;
    });
}
