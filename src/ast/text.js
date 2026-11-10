import { createNode, createParseResult } from "./model.js";
import { attributesFromText } from "./text-attributes.js";
/** Parse Clang's text tree, retaining line provenance and recoverable input errors. */
export function parseAstDump(input) {
  if (typeof input !== "string" || !input.trim())
    throw new Error("Paste a Clang AST dump first.");
  if (input.length > 1_000_000)
    throw new Error("Input exceeds the 1 MB limit.");
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  const diagnostics = [];
  const stack = [];
  const roots = [];
  let count = 0;
  for (let index = 0; index < lines.length; index++) {
    const original = lines[index];
    if (!original.trim()) continue;
    const line = index + 1;
    const tree = original.match(/^((?:\| |  )*)(\|-|`-)(.*)$/);
    const plain = original.match(/^( *)(\S.*)$/);
    let depth, content;
    if (tree) {
      depth = tree[1].length / 2 + 1;
      content = tree[3].trim();
    } else if (plain) {
      content = plain[2].trim();
      // A stripped prefix is commonly replaced by indentation only.
      depth = plain[1].length
        ? Math.max(1, Math.round(plain[1].length / 2))
        : 0;
      if (depth > 0)
        diagnostics.push({
          level: "warning",
          line,
          message: "Tree prefix is missing; inferred depth from indentation.",
        });
    } else {
      diagnostics.push({
        level: "warning",
        line,
        message: "Unreadable line skipped.",
      });
      continue;
    }
    const match = content.match(/^([A-Za-z_]\w*)(?:\s+(.*))?$/);
    if (!match) {
      diagnostics.push({
        level: "warning",
        line,
        message:
          "Could not read a node kind; line skipped. Check for a typo or stray character.",
      });
      continue;
    }
    if (depth > 256)
      throw new Error(`Line ${line}: maximum nesting depth (256) exceeded.`);
    const kind = match[1];
    const metadata = match[2] || "";
    const node = createNode({
      kind,
      metadata,
      raw: original,
      attributes: attributesFromText(kind, metadata),
      line,
      depth,
      id: count++,
    });
    if (count > 25_000) throw new Error("More than 25,000 AST nodes.");
    if (depth === 0 || !stack.length) {
      if (depth > 0)
        diagnostics.push({
          level: "warning",
          line,
          message: "Orphaned tree branch treated as a root.",
        });
      roots.push(node);
      stack.length = 0;
      stack.push(node);
    } else {
      if (depth > stack.length) {
        diagnostics.push({
          level: "warning",
          line,
          message: `Missing parent level; attached to the nearest node. Check indentation near line ${line}.`,
        });
        depth = stack.length;
      }
      stack.length = depth;
      stack[depth - 1].children.push(node);
      stack.push(node);
    }
  }
  if (!roots.length)
    throw new Error(
      "No AST nodes found. Check the first node kind and tree prefixes.",
    );
  if (roots.length > 1)
    diagnostics.push({
      level: "warning",
      line: roots[1].line,
      message: `${roots.length} root nodes found; showing the first subtree.`,
    });
  return createParseResult(roots[0], count, diagnostics, roots);
}
