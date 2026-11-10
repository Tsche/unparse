import { state } from "./state.js";
import { syntax, icons, copyText, mapSpans } from "./shared.js";
import { updateLinkedHighlights, focusInputLine } from "./input-pane.js";
import { diagnosticSummary } from "./diagnostic-view.js";

const panes = state.panes;
export function setupOutput(pane) {
  pane.format = true;
  pane.request = 0;
  pane.raw = "";
  pane.displayed = "";
  pane.spans = [];
  pane.body.innerHTML = `<div class="pane-toolbar output-toolbar"><span class="format-error" role="status" hidden></span><div class="format-controls"><label class="format-label"><input class="format-toggle" type="checkbox" checked> Format</label><details class="settings-menu"><summary>Settings</summary><div class="settings-panel"><label>Preset <select class="style"><option>LLVM</option><option>Google</option><option>Chromium</option><option>Mozilla</option><option>Microsoft</option><option>GNU</option><option>WebKit</option></select></label><label>Column width <input class="column-limit" type="number" min="30" max="200" value="80"></label><label>Indent width <input class="indent-width" type="number" min="1" max="8" value="2"></label><label>Custom .clang-format <textarea class="custom-config" spellcheck="false" placeholder="Optional YAML or JSON overrides quick settings"></textarea></label><a href="https://clang.llvm.org/docs/ClangFormatStyleOptions.html" target="_blank" rel="noopener noreferrer">All clang-format options ↗</a></div></details></div></div><div class="output-code"><button class="copy-button" type="button" aria-label="Copy C++" title="Copy C++">${icons.copy}</button><pre class="cpp-output" tabindex="0"></pre></div><details class="notes" hidden><summary><span class="diagnostic-count"></span></summary><ul></ul></details>`;
  pane.output = pane.body.querySelector(".cpp-output");
  pane.body
    .querySelector(".format-toggle")
    .addEventListener("change", (event) => {
      pane.format = event.target.checked;
      renderOutput(pane);
    });
  for (const control of pane.body.querySelectorAll(
    ".style,.column-limit,.indent-width,.custom-config",
  ))
    control.addEventListener("change", () => renderOutput(pane));
  pane.body
    .querySelector(".copy-button")
    .addEventListener("click", () => copyText(pane.displayed));
  const settings = pane.body.querySelector(".settings-menu");
  settings.addEventListener("toggle", () => {
    pane.body.querySelector(".copy-button").hidden = settings.open;
  });
  pane.output.addEventListener("pointermove", (event) => {
    const id = event.target.closest("[data-node]")?.dataset.node;
    const input = panes.get(pane.inputId);
    if (!input || !id) return;
    input.activeId = Number(id);
    updateLinkedHighlights(input);
  });
  pane.output.addEventListener("pointerleave", () => {
    const input = panes.get(pane.inputId);
    if (input) {
      input.activeId = null;
      updateLinkedHighlights(input);
    }
  });
  renderOutput(pane);
}
export function renderOutput(pane) {
  const request = ++pane.request;
  const input = panes.get(pane.inputId);
  pane.raw = input?.result?.emitted.source || "";
  pane.spans = input?.result?.emitted.spans || [];
  const notes = pane.body.querySelector(".notes");
  const diagnostics = input?.diagnostics || [];
  const summary = diagnosticSummary(diagnostics);
  notes.hidden = !diagnostics.length;
  notes.dataset.severity = summary.severity;
  notes.querySelector(".diagnostic-count").textContent = summary.label;
  notes.querySelector("ul").replaceChildren(
    ...diagnostics.map((d) => {
      const item = document.createElement("li");
      item.textContent = `${d.line ? `Line ${d.line}: ` : ""}${d.message}`;
      if (d.line)
        item.addEventListener("click", () => focusInputLine(input, d.line));
      return item;
    }),
  );
  displayOutput(pane, pane.raw);
  const formatError = pane.body.querySelector(".format-error");
  formatError.hidden = true;
  if (!pane.raw || !pane.format) return;
  (async () => {
    try {
      const { formatCpp } = await import("../format/clang-format.js");
      const style = pane.body.querySelector(".style").value;
      const columnLimit = Number(
        pane.body.querySelector(".column-limit").value,
      );
      const indentWidth = Number(
        pane.body.querySelector(".indent-width").value,
      );
      if (
        !Number.isInteger(columnLimit) ||
        columnLimit < 30 ||
        columnLimit > 200
      )
        throw new Error("Column width must be 30–200.");
      if (!Number.isInteger(indentWidth) || indentWidth < 1 || indentWidth > 8)
        throw new Error("Indent width must be 1–8.");
      const customConfig = pane.body
        .querySelector(".custom-config")
        .value.trim();
      const formatted = await formatCpp(pane.raw, {
        style,
        columnLimit,
        indentWidth,
        customConfig,
      });
      if (pane.request !== request) return;
      displayOutput(pane, formatted);
    } catch (error) {
      if (pane.request !== request) return;
      formatError.textContent = `Formatting failed: ${error.message}`;
      formatError.hidden = false;
    }
  })();
}
function displayOutput(pane, source) {
  pane.displayed = source;
  if (!source) {
    pane.output.innerHTML =
      '<span class="token-comment">// Reconstructed C++ appears here.</span>';
    return;
  }
  const spans = mapSpans(pane.raw, source, pane.spans);
  const cuts = [
    ...new Set([0, source.length, ...spans.flatMap((s) => [s.start, s.end])]),
  ].sort((a, b) => a - b);
  const input = panes.get(pane.inputId);
  const active =
    input?.result?.descendantsById.get(input.activeId) ?? new Set();
  pane.output.innerHTML = cuts
    .slice(0, -1)
    .map((start, i) => {
      const end = cuts[i + 1];
      const selected = spans
        .filter((s) => s.start <= start && s.end >= end)
        .sort((a, b) => a.end - a.start - (b.end - b.start))[0];
      return `<span data-node="${selected?.id ?? ""}" class="${selected && active.has(selected.id) ? "linked-active" : ""}">${syntax(source.slice(start, end), "cpp")}</span>`;
    })
    .join("");
}

function refreshOutputsFor(inputId) {
  for (const pane of panes.values()) {
    if (pane.type === "output" && pane.inputId === inputId) renderOutput(pane);
  }
}
state.refreshOutputsFor = refreshOutputsFor;
