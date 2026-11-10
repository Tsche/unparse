/** Build lookup tables for highlighting a node and its full emitted subtree. */
export function indexTree(root) {
  const lineById = new Map();
  const rangeById = new Map();
  const ownerByLine = new Map();
  const descendantsById = new Map();
  function visit(node) {
    lineById.set(node.id, node.line);
    if (node.provenance.start !== undefined)
      rangeById.set(node.id, node.provenance);
    const ids = new Set([node.id]);
    for (const child of node.children)
      for (const id of visit(child)) ids.add(id);
    descendantsById.set(node.id, ids);
    return ids;
  }
  visit(root);
  if (rangeById.size) {
    const ranges = [...rangeById].sort(
      (a, b) => a[1].startLine - b[1].startLine,
    );
    let next = 0;
    let active = [];
    const lastLine = Math.max(...ranges.map(([, range]) => range.endLine));
    for (let line = 1; line <= lastLine; line++) {
      while (next < ranges.length && ranges[next][1].startLine <= line)
        active.push(ranges[next++]);
      active = active.filter(([, range]) => range.endLine >= line);
      const smallest = active.reduce(
        (best, entry) =>
          !best || entry[1].end - entry[1].start < best[1].end - best[1].start
            ? entry
            : best,
        null,
      );
      if (smallest) ownerByLine.set(line, smallest[0]);
    }
  }
  return { lineById, rangeById, ownerByLine, descendantsById };
}

/** The innermost JSON AST object that contains this source line. */
export function nodeAtLine(result, line) {
  if (!result) return null;
  if (result.rangeById.size) return result.ownerByLine.get(line) ?? null;
  for (const [id, number] of result.lineById) if (number === line) return id;
  return null;
}

/** Nodes whose own syntax adds no characters to the reconstructed output. */
export function unmappedNodeIds(root, spans) {
  const byId = new Map(spans.map((span) => [span.id, span]));
  const result = new Set();
  function visit(node) {
    const span = byId.get(node.id);
    if (span) {
      const children = node.children
        .map((child) => byId.get(child.id))
        .filter(Boolean)
        .sort((a, b) => a.start - b.start);
      let covered = span.start;
      for (const child of children)
        if (child.start <= covered) covered = Math.max(covered, child.end);
      if (span.start === span.end || covered >= span.end) result.add(node.id);
    }
    node.children.forEach(visit);
  }
  visit(root);
  return result;
}
