/**
 * Format-neutral AST node used by the reconstruction pipeline.
 * `attributes` contains semantic fields, while `provenance` points back to input.
 * Adapters may retain `metadata` for diagnostics without making emitters parse it.
 */
export function createNode({
  kind,
  attributes = {},
  children = [],
  line = 1,
  depth = 0,
  id,
  metadata = "",
  raw = null,
}) {
  if (typeof kind !== "string" || !kind)
    throw new Error("AST node kind is required.");
  return {
    kind,
    attributes,
    children,
    line,
    depth,
    id,
    metadata,
    raw,
    provenance: { line, format: attributes.format || "text" },
  };
}

export function createParseResult(
  root,
  nodeCount,
  diagnostics = [],
  roots = [root],
) {
  return { root, roots, nodeCount, diagnostics };
}
