import { handlers } from "./handlers.js";

function closestKind(value) {
  const distance = (a, b) => {
    const row = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i++) {
      let previous = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const old = row[j];
        row[j] = Math.min(
          row[j] + 1,
          row[j - 1] + 1,
          previous + (a[i - 1] === b[j - 1] ? 0 : 1),
        );
        previous = old;
      }
    }
    return row[b.length];
  };
  const match = Object.keys(handlers)
    .map((kind) => ({ kind, score: distance(value, kind) }))
    .sort((a, b) => a.score - b.score)[0];
  return match?.score <= 2 ? match.kind : null;
}

/** Reconstruct C++ plus node-to-output spans and diagnostics. */
export function emitCpp(root) {
  const diagnostics = [];
  let supportedNodeCount = 0;
  const marker = (id, end = false) => `\uE000${end ? "/" : ""}${id}\uE001`;
  const context = {
    warn(node, message) {
      diagnostics.push({ level: "warning", line: node.line, message });
    },
    need(node, count) {
      if (node.children.length >= count) return true;
      this.warn(
        node,
        `${node.kind} needs ${count} child node(s), got ${node.children.length}.`,
      );
      return false;
    },
    child(node, index) {
      return node.children[index]
        ? this.print(node.children[index])
        : "/* missing operand */";
    },
    print(node) {
      const handler = handlers[node.kind];
      let value;
      if (handler) {
        value = handler(node, this);
        supportedNodeCount++;
      } else {
        value = `(/* unsupported ${node.kind} */ ${node.children.map((child) => this.print(child)).join(", ") || "0"})`;
      }
      return marker(node.id) + value + marker(node.id, true);
    },
  };

  function checkKinds(node) {
    if (!handlers[node.kind]) {
      const suggestion = closestKind(node.kind);
      context.warn(
        node,
        `Unsupported AST node: ${node.kind}.${suggestion ? ` Did you mean ${suggestion}?` : ""}`,
      );
    }
    node.children.forEach(checkKinds);
  }
  checkKinds(root);

  const marked = context.print(root);
  const starts = new Map();
  const spans = [];
  let source = "";
  let cursor = 0;
  for (const match of marked.matchAll(/\uE000(\/?)((?:\d+))\uE001/g)) {
    source += marked.slice(cursor, match.index);
    const id = Number(match[2]);
    if (match[1])
      spans.push({
        id,
        start: starts.get(id) ?? source.length,
        end: source.length,
      });
    else starts.set(id, source.length);
    cursor = match.index + match[0].length;
  }
  source += marked.slice(cursor);
  const status = diagnostics.some((d) =>
    /Unsupported|missing|needs|malformed/i.test(d.message),
  )
    ? "unsupported"
    : diagnostics.length
      ? "inferred"
      : "exact";
  return { source, spans, diagnostics, supportedNodeCount, status };
}
