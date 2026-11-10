import { state } from "./state.js";
import { icons } from "./shared.js";
import { setupInput, parseInput } from "./input-pane.js";
import { setupOutput } from "./output-pane.js";
import {
  leaf,
  insertPane,
  movePane,
  removePane,
  paneIds,
} from "./dock-layout.js";
import { clampSplit } from "./split-math.js";

const workspace = document.getElementById("workspace");
const mobileTabs = document.getElementById("mobile-tabs");
const panes = state.panes;
function createPane(type, inputId = null) {
  const id = `pane-${state.nextId++}`;
  const pane = {
    id,
    type,
    title: `${type === "input" ? "AST input" : "C++ output"} ${type === "input" ? id.split("-")[1] : inputId?.split("-")[1]}`,
    element: null,
    inputId,
  };
  const element = document.createElement("section");
  element.className = `pane ${type}-pane`;
  element.dataset.paneId = id;
  pane.element = element;
  element.innerHTML = `<header class="pane-header" draggable="true" title="Drag to move pane"><strong class="pane-title">${pane.title}</strong><div class="pane-controls"><button class="rename-pane" type="button" title="Rename pane" aria-label="Rename ${pane.title}">${icons.edit}</button>${type === "input" ? `<button class="open-output" type="button" title="Open C++ output for this input" aria-label="Open C++ output for ${pane.title}">Open output</button>` : ""}<button class="pane-close" type="button" aria-label="Close ${pane.title}" title="Close pane">×</button></div></header><div class="pane-body"></div><div class="drop-overlay" hidden><div class="drop-zone" data-edge="top">Above</div><div class="drop-zone" data-edge="left">Left</div><div class="drop-zone" data-edge="right">Right</div><div class="drop-zone" data-edge="bottom">Below</div></div>`;
  pane.body = element.querySelector(".pane-body");
  element
    .querySelector(".rename-pane")
    .addEventListener("click", () => beginRename(pane));
  element
    .querySelector(".pane-close")
    .addEventListener("click", () => closePane(id));
  element
    .querySelector(".open-output")
    ?.addEventListener("click", () => openOutputForInput(id));
  const handle = element.querySelector(".pane-header");
  handle.addEventListener("dragstart", (event) => {
    if (event.target.closest("button, select, input, textarea, summary")) {
      event.preventDefault();
      return;
    }
    state.draggingId = id;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
    requestAnimationFrame(() => showDropZones(id));
  });
  handle.addEventListener("dragend", () => {
    state.draggingId = null;
    showDropZones(null);
  });
  for (const zone of element.querySelectorAll(".drop-zone")) {
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      zone.classList.add("over");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("over"));
    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      zone.classList.remove("over");
      const moving =
        state.draggingId || event.dataTransfer.getData("text/plain");
      if (moving && moving !== id) dockPane(moving, id, zone.dataset.edge);
      state.draggingId = null;
      showDropZones(null);
    });
  }
  panes.set(id, pane);
  if (type === "input") setupInput(pane);
  else setupOutput(pane);
  return pane;
}

function beginRename(pane) {
  const title = pane.element.querySelector(".pane-title");
  if (pane.element.querySelector(".pane-title-edit")) return;
  const field = document.createElement("input");
  field.className = "pane-title-edit";
  field.setAttribute("aria-label", "Pane name");
  field.maxLength = 60;
  field.value = pane.title;
  title.hidden = true;
  title.after(field);
  field.focus();
  field.select();
  let finished = false;
  function finish(save) {
    if (finished) return;
    finished = true;
    if (save && field.value.trim()) pane.title = field.value.trim();
    title.textContent = pane.title;
    title.hidden = false;
    field.remove();
    pane.element
      .querySelector(".rename-pane")
      .setAttribute("aria-label", `Rename ${pane.title}`);
    pane.element
      .querySelector(".pane-close")
      .setAttribute("aria-label", `Close ${pane.title}`);
    refreshOutputButtons();
    renderWorkspace();
  }
  field.addEventListener("keydown", (event) => {
    if (event.key === "Enter") finish(true);
    if (event.key === "Escape") finish(false);
  });
  field.addEventListener("blur", () => finish(true));
}
function showDropZones(except) {
  for (const pane of panes.values())
    pane.element.querySelector(".drop-overlay").hidden =
      !except || pane.id === except;
}
function dockPane(id, target, edge) {
  state.tree = movePane(state.tree, id, target, edge);
  renderWorkspace();
}
function refreshOutputButtons() {
  for (const pane of panes.values()) {
    if (pane.type !== "input") continue;
    const button = pane.element.querySelector(".open-output");
    const output = [...panes.values()].find(
      (candidate) =>
        candidate.type === "output" && candidate.inputId === pane.id,
    );
    button.hidden = Boolean(output);
    button.textContent = "Open output";
    button.title = "Open C++ output for this input";
    button.setAttribute("aria-label", `${button.title} (${pane.title})`);
  }
}
function closePane(id) {
  const pane = panes.get(id);
  if (!pane) return;
  if (
    pane.type === "input" &&
    [...panes.values()].filter((candidate) => candidate.type === "input")
      .length <= 1
  )
    return;
  const ids =
    pane.type === "input"
      ? [
          id,
          ...[...panes.values()]
            .filter(
              (candidate) =>
                candidate.type === "output" && candidate.inputId === id,
            )
            .map((candidate) => candidate.id),
        ]
      : [id];
  for (const removed of ids) {
    state.tree = removePane(state.tree, removed);
    panes.get(removed).element.remove();
    panes.delete(removed);
  }
  if (ids.includes(state.activeMobileId))
    state.activeMobileId = paneIds(state.tree)[0];
  refreshOutputButtons();
  renderWorkspace();
}
export function addPane(type = "input") {
  if (type !== "input")
    throw new Error("Output panes must be opened from an input pane.");
  const pane = createPane("input");
  if (!state.tree) state.tree = leaf(pane.id);
  else {
    const target =
      state.activeMobileId && panes.has(state.activeMobileId)
        ? state.activeMobileId
        : paneIds(state.tree).at(-1);
    state.tree = insertPane(state.tree, pane.id, target, "right");
  }
  state.activeMobileId = pane.id;
  renderWorkspace();
  return pane;
}
export function openOutputForInput(inputId) {
  const input = panes.get(inputId);
  if (!input || input.type !== "input")
    throw new Error("Choose an input pane first.");
  const existing = [...panes.values()].find(
    (candidate) => candidate.type === "output" && candidate.inputId === inputId,
  );
  if (existing) {
    state.activeMobileId = existing.id;
    updateMobile();
    return existing;
  }
  const pane = createPane("output", inputId);
  state.tree = insertPane(state.tree, pane.id, inputId, "right");
  state.activeMobileId = pane.id;
  refreshOutputButtons();
  renderWorkspace();
  return pane;
}
export function renderWorkspace() {
  function build(node) {
    if (node.type === "leaf") return panes.get(node.id).element;
    const box = document.createElement("div");
    box.className = `dock-split ${node.direction}`;
    box.style.setProperty("--ratio", `${node.ratio}%`);
    const first = build(node.first),
      second = build(node.second);
    const divider = document.createElement("div");
    divider.className = "dock-divider";
    divider.tabIndex = 0;
    divider.setAttribute("role", "separator");
    divider.setAttribute(
      "aria-label",
      `Resize ${node.direction === "row" ? "horizontal" : "vertical"} panes`,
    );
    divider.setAttribute(
      "aria-orientation",
      node.direction === "row" ? "vertical" : "horizontal",
    );
    divider.setAttribute("aria-valuemin", "15");
    divider.setAttribute("aria-valuemax", "85");
    const resize = (value) => {
      node.ratio = clampSplit(value);
      box.style.setProperty("--ratio", `${node.ratio}%`);
      divider.setAttribute("aria-valuenow", String(Math.round(node.ratio)));
    };
    resize(node.ratio);
    divider.addEventListener("pointerdown", (event) => {
      divider.setPointerCapture(event.pointerId);
      document.body.classList.add("resizing");
      event.preventDefault();
    });
    divider.addEventListener("pointermove", (event) => {
      if (!divider.hasPointerCapture(event.pointerId)) return;
      const bounds = box.getBoundingClientRect();
      const percent =
        node.direction === "row"
          ? ((event.clientX - bounds.left) / bounds.width) * 100
          : ((event.clientY - bounds.top) / bounds.height) * 100;
      resize(percent);
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
      divider.addEventListener(name, () =>
        document.body.classList.remove("resizing"),
      );
    divider.addEventListener("dblclick", () => resize(50));
    divider.addEventListener("keydown", (event) => {
      const step = { ArrowLeft: -3, ArrowUp: -3, ArrowRight: 3, ArrowDown: 3 }[
        event.key
      ];
      if (step === undefined) return;
      event.preventDefault();
      resize(node.ratio + step);
    });
    box.append(first, divider, second);
    return box;
  }
  workspace.replaceChildren(build(state.tree));
  mobileTabs.replaceChildren(
    ...paneIds(state.tree).map((id) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.textContent = panes.get(id).title;
      tab.dataset.paneId = id;
      tab.setAttribute(
        "aria-current",
        id === state.activeMobileId ? "page" : "false",
      );
      tab.addEventListener("click", () => {
        state.activeMobileId = id;
        updateMobile();
      });
      return tab;
    }),
  );
  updateMobile();
}
export function updateMobile() {
  for (const pane of panes.values())
    pane.element.classList.toggle(
      "mobile-active",
      pane.id === state.activeMobileId,
    );
  for (const tab of mobileTabs.children)
    tab.setAttribute(
      "aria-current",
      tab.dataset.paneId === state.activeMobileId ? "page" : "false",
    );
}

function encodedTree(node, positions) {
  return node.type === "leaf"
    ? positions.get(node.id)
    : [
        node.direction === "row" ? 0 : 1,
        Math.round(node.ratio),
        encodedTree(node.first, positions),
        encodedTree(node.second, positions),
      ];
}

export function captureWorkspace() {
  const all = [...panes.values()];
  const positions = new Map(all.map((pane, index) => [pane.id, index]));
  return {
    panes: all.map((pane, index) => {
      const defaultTitle =
        pane.type === "input"
          ? `AST input ${index + 1}`
          : `C++ output ${positions.get(pane.inputId) + 1}`;
      const title = pane.title === defaultTitle ? null : pane.title;
      if (pane.type === "input")
        return {
          type: "input",
          kind: pane.kind,
          value: pane.textarea.value,
          title,
        };
      return {
        type: "output",
        inputIndex: positions.get(pane.inputId),
        title,
        format: pane.format,
        style: pane.body.querySelector(".style").value,
        columnLimit: Number(pane.body.querySelector(".column-limit").value),
        indentWidth: Number(pane.body.querySelector(".indent-width").value),
        customConfig: pane.body.querySelector(".custom-config").value,
      };
    }),
    tree: encodedTree(state.tree, positions),
    active: positions.get(state.activeMobileId) ?? 0,
  };
}

export function restoreWorkspace(snapshot) {
  for (const pane of panes.values()) pane.element.remove();
  panes.clear();
  state.nextId = 1;
  state.tree = null;
  const created = [];
  for (const item of snapshot.panes) {
    const inputId = item.type === "output" ? created[item.inputIndex].id : null;
    const pane = createPane(item.type, inputId);
    created.push(pane);
    if (item.title) {
      pane.title = item.title;
      pane.element.querySelector(".pane-title").textContent = item.title;
      pane.element
        .querySelector(".rename-pane")
        .setAttribute("aria-label", `Rename ${item.title}`);
      pane.element
        .querySelector(".pane-close")
        .setAttribute("aria-label", `Close ${item.title}`);
    }
    if (item.type === "input") {
      if (item.kind === "json") {
        const select = pane.body.querySelector(".input-kind");
        select.value = "json";
        select.dispatchEvent(new Event("change"));
      }
      pane.textarea.value = item.value;
    } else {
      pane.format = item.format;
      pane.body.querySelector(".format-toggle").checked = item.format;
      pane.body.querySelector(".style").value = item.style;
      pane.body.querySelector(".column-limit").value = item.columnLimit;
      pane.body.querySelector(".indent-width").value = item.indentWidth;
      pane.body.querySelector(".custom-config").value = item.customConfig;
    }
  }
  function treeFrom(value) {
    return Number.isInteger(value)
      ? leaf(created[value].id)
      : {
          type: "split",
          direction: value[0] ? "column" : "row",
          ratio: value[1],
          first: treeFrom(value[2]),
          second: treeFrom(value[3]),
        };
  }
  state.tree = treeFrom(snapshot.tree);
  state.activeMobileId = created[snapshot.active].id;
  refreshOutputButtons();
  renderWorkspace();
  for (const pane of created) if (pane.type === "input") parseInput(pane);
}

state.updateMobile = updateMobile;
