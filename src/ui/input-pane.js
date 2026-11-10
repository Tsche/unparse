import { state } from "./state.js";
import { syntax, icons, copyText } from "./shared.js";
import { parseAst } from "../ast/index.js";
import { convertAst } from "../ast/serialize.js";
import { formatJsonAst } from "../ast/format-json.js";
import { emitCpp } from "../emit/index.js";
import { indexTree, nodeAtLine, unmappedNodeIds } from "./provenance.js";
import {
  diagnosticsByLine,
  unknownKindLines,
  diagnosticGutters,
} from "./diagnostic-view.js";

const panes = state.panes;
export function setupInput(pane) {
  pane.kind = "text";
  pane.value = "";
  pane.result = null;
  pane.diagnostics = [];
  pane.activeId = null;
  pane.body.innerHTML = `<div class="pane-toolbar input-toolbar"><select class="input-kind" aria-label="Input kind" title="Input kind"><option value="text">Text AST</option><option value="json">JSON AST</option></select><select class="example-select" aria-label="Load example" title="Load example"><option value="">Load example…</option><option value="assert-ast.txt">assert(false)</option><option value="arithmetic-ast.txt">Arithmetic</option></select><button class="format-json" type="button" hidden>Format JSON</button><span class="input-count">0 lines</span></div><div class="code-editor"><button class="copy-button" type="button" aria-label="Copy AST" title="Copy AST">${icons.copy}</button><pre class="ast-highlight" aria-hidden="true"></pre><textarea class="ast-input" spellcheck="false" aria-label="Clang AST dump" placeholder="Paste a Clang AST expression subtree…"></textarea><div class="ast-tooltip" hidden></div></div><div class="pane-foot"><span class="input-status">Paste an AST dump to begin</span></div>`;
  pane.textarea = pane.body.querySelector(".ast-input");
  pane.highlight = pane.body.querySelector(".ast-highlight");
  pane.tooltip = pane.body.querySelector(".ast-tooltip");
  updateExampleOptions(pane);
  pane.body.querySelector(".input-kind").addEventListener("change", (event) => {
    const next = event.target.value;
    const previous = pane.kind;
    if (pane.textarea.value.trim()) {
      try {
        pane.textarea.value = convertAst(pane.textarea.value, previous, next);
      } catch (error) {
        event.target.value = previous;
        pane.body.querySelector(".input-status").textContent =
          `Could not convert input: ${error.message}`;
        return;
      }
    }
    pane.kind = next;
    if (next === "json" && pane.textarea.value.trim())
      pane.textarea.value = formatJsonAst(pane.textarea.value);
    updateExampleOptions(pane);
    parseInput(pane);
    if (previous === "json" && next === "text") {
      pane.body.querySelector(".input-status").textContent +=
        " · JSON-only fields may be omitted";
    }
  });
  pane.body
    .querySelector(".example-select")
    .addEventListener("change", async (event) => {
      const filename = event.target.value;
      if (!filename) return;
      try {
        const response = await fetch(
          `${import.meta.env.BASE_URL}examples/${filename}`,
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const value = await response.text();
        pane.textarea.value =
          pane.kind === "json" ? formatJsonAst(value) : value;
        parseInput(pane);
      } catch (error) {
        pane.body.querySelector(".input-status").textContent =
          `Could not load example: ${error.message}`;
      }
      event.target.value = "";
    });
  pane.body
    .querySelector(".copy-button")
    .addEventListener("click", () => copyText(pane.value));
  pane.body.querySelector(".format-json").addEventListener("click", () => {
    try {
      pane.textarea.value = formatJsonAst(pane.textarea.value);
      parseInput(pane);
    } catch (error) {
      pane.body.querySelector(".input-status").textContent =
        `Invalid JSON: ${error.message}`;
    }
  });
  let timer;
  pane.textarea.addEventListener("input", () => {
    pane.value = pane.textarea.value;
    updateInputHighlight(pane);
    clearTimeout(timer);
    timer = setTimeout(() => parseInput(pane), 100);
  });
  pane.textarea.addEventListener("scroll", () => {
    pane.highlight.scrollTop = pane.textarea.scrollTop;
    pane.highlight.scrollLeft = pane.textarea.scrollLeft;
  });
  pane.textarea.addEventListener("mousemove", (event) => {
    const rect = pane.textarea.getBoundingClientRect();
    const style = getComputedStyle(pane.textarea);
    const line =
      Math.floor(
        (event.clientY -
          rect.top +
          pane.textarea.scrollTop -
          parseFloat(style.paddingTop)) /
          parseFloat(style.lineHeight),
      ) + 1;
    pane.activeId = nodeAtLine(pane.result, line);
    updateLinkedHighlights(pane);
    const messages = pane.result?.messages.get(line);
    pane.tooltip.hidden = !messages?.length;
    pane.tooltip.classList.toggle(
      "warning-tooltip",
      !pane.result?.gutters.errors.has(line),
    );
    if (messages?.length) {
      pane.tooltip.textContent = messages.join(" ");
      pane.tooltip.style.left = `${Math.max(8, Math.min(event.clientX - rect.left + 12, rect.width - 350))}px`;
      pane.tooltip.style.top = `${Math.max(8, Math.min(event.clientY - rect.top + 16, rect.height - pane.tooltip.offsetHeight - 8))}px`;
    }
  });
  pane.textarea.addEventListener("mouseleave", () => {
    pane.activeId = null;
    pane.tooltip.hidden = true;
    updateLinkedHighlights(pane);
  });
  pane.textarea.addEventListener("click", () => {
    const line = pane.value
      .slice(0, pane.textarea.selectionStart)
      .split("\n").length;
    pane.activeId = nodeAtLine(pane.result, line);
    updateLinkedHighlights(pane);
  });
}

function updateExampleOptions(pane) {
  pane.body.querySelector(".format-json").hidden = pane.kind !== "json";
  const select = pane.body.querySelector(".example-select");
  const extension = pane.kind === "json" ? "json" : "txt";
  select.replaceChildren(
    new Option("Load example…", ""),
    new Option("assert(false)", `assert-ast.${extension}`),
    new Option("Arithmetic", `arithmetic-ast.${extension}`),
  );
}

export function parseInput(pane) {
  pane.value = pane.textarea.value;
  if (!pane.value.trim()) {
    pane.result = null;
    pane.diagnostics = [];
    pane.body.querySelector(".input-status").textContent =
      "Paste an AST dump to begin";
    updateInputHighlight(pane);
    state.refreshOutputsFor(pane.id);
    return;
  }
  try {
    const parsed = parseAst(pane.value, pane.kind);
    const emitted = emitCpp(parsed.root);
    const diagnostics = [...parsed.diagnostics, ...emitted.diagnostics];
    pane.result = {
      parsed,
      emitted,
      ...indexTree(parsed.root),
      unmapped: unmappedNodeIds(parsed.root, emitted.spans),
      messages: diagnosticsByLine(diagnostics),
      unknown: unknownKindLines(diagnostics),
      gutters: diagnosticGutters(diagnostics),
    };
    pane.diagnostics = diagnostics;
    pane.body.querySelector(".input-status").textContent =
      `${parsed.nodeCount} nodes`;
  } catch (error) {
    pane.result = null;
    pane.diagnostics = [{ line: 0, message: error.message }];
    pane.body.querySelector(".input-status").textContent =
      `Input error: ${error.message}`;
  }
  pane.activeId = null;
  updateInputHighlight(pane);
  state.refreshOutputsFor(pane.id);
}
function updateInputHighlight(pane) {
  const result = pane.result;
  const active = result?.descendantsById.get(pane.activeId) ?? new Set();
  pane.highlight.innerHTML = pane.value
    .split("\n")
    .map((line, index) => {
      const number = index + 1;
      const id = nodeAtLine(result, number);
      const classes = ["ast-line"];
      if (id !== undefined && active.has(id)) classes.push("linked-active");
      if (id !== undefined && result?.unmapped.has(id))
        classes.push("unmapped-node");
      if (result?.gutters.errors.has(number)) classes.push("error-node");
      else if (result?.gutters.warnings.has(number))
        classes.push("warning-node");
      return `<span class="${classes.join(" ")}" data-line="${number}">${syntax(line || " ", pane.kind === "json" ? "json" : "ast", result?.unknown.has(number))}</span>`;
    })
    .join("");
  pane.highlight.scrollTop = pane.textarea.scrollTop;
  pane.highlight.scrollLeft = pane.textarea.scrollLeft;
  pane.body.querySelector(".input-count").textContent =
    `${pane.value ? pane.value.split("\n").length : 0} lines`;
}

export function updateLinkedHighlights(input) {
  const active = input.result?.descendantsById.get(input.activeId) ?? new Set();
  for (const line of input.highlight.querySelectorAll("[data-line]")) {
    const id = nodeAtLine(input.result, Number(line.dataset.line));
    line.classList.toggle("linked-active", active.has(id));
  }
  for (const pane of panes.values())
    if (pane.type === "output" && pane.inputId === input.id) {
      for (const span of pane.output.querySelectorAll("[data-node]"))
        span.classList.toggle(
          "linked-active",
          span.dataset.node !== "" && active.has(Number(span.dataset.node)),
        );
    }
}
export function focusInputLine(input, line) {
  if (!input) return;
  state.activeMobileId = input.id;
  state.updateMobile();
  const lines = input.value.split("\n");
  const start = lines
    .slice(0, line - 1)
    .reduce((sum, text) => sum + text.length + 1, 0);
  input.textarea.focus();
  input.textarea.setSelectionRange(
    start,
    start + (lines[line - 1]?.length || 0),
  );
  input.textarea.scrollTop = Math.max(
    0,
    (line - 3) * parseFloat(getComputedStyle(input.textarea).lineHeight),
  );
}
