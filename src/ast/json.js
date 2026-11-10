import { parseTree, findNodeAtLocation } from "jsonc-parser";
import { createNode, createParseResult } from "./model.js";

/** Adapt a Clang JSON AST while retaining exact source ranges for every `inner` node. */
export function parseJsonAst(input) {
  if (typeof input !== "string" || !input.trim())
    throw new Error("Paste a Clang JSON AST dump first.");
  if (input.length > 1_000_000)
    throw new Error("Input exceeds the 1 MB limit.");

  let data;
  try {
    data = JSON.parse(input);
  } catch (error) {
    throw new Error(`Invalid AST JSON: ${error.message}`);
  }
  if (
    !data ||
    Array.isArray(data) ||
    typeof data !== "object" ||
    typeof data.kind !== "string"
  )
    throw new Error('Expected a Clang JSON AST object with a "kind" property.');

  const tree = parseTree(input);
  const lineStarts = [0];
  for (let index = 0; index < input.length; index++)
    if (input[index] === "\n") lineStarts.push(index + 1);
  function lineAt(offset) {
    let low = 0;
    let high = lineStarts.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (lineStarts[middle] <= offset) low = middle + 1;
      else high = middle;
    }
    return low;
  }

  let count = 0;
  const diagnostics = [];
  function convert(item, sourceNode, depth) {
    if (depth > 256)
      throw new Error("Maximum AST nesting depth (256) exceeded.");
    if (
      !item ||
      Array.isArray(item) ||
      typeof item !== "object" ||
      typeof item.kind !== "string"
    )
      throw new Error("AST child is missing a node kind.");
    if (++count > 25_000) throw new Error("More than 25,000 AST nodes.");

    const kindNode = findNodeAtLocation(sourceNode, ["kind"]);
    const line = lineAt(kindNode?.offset ?? sourceNode.offset);
    const children = item.inner ?? [];
    if (!Array.isArray(children))
      throw new Error(`Node ${item.kind}: "inner" must be an array.`);
    const node = createNode({
      kind: item.kind,
      attributes: attributesFromJson(item),
      line,
      depth,
      id: count - 1,
      raw: item,
      metadata: item.unparseTextMetadata || "",
    });
    node.provenance.start = sourceNode.offset;
    node.provenance.end = sourceNode.offset + sourceNode.length;
    node.provenance.startLine = lineAt(sourceNode.offset);
    node.provenance.endLine = lineAt(sourceNode.offset + sourceNode.length - 1);
    const innerNode = findNodeAtLocation(sourceNode, ["inner"]);
    for (let index = 0; index < children.length; index++) {
      const child = children[index];
      if (!child || typeof child.kind !== "string") {
        if (!(item.kind === "ForStmt" && child === null))
          diagnostics.push({
            level: "warning",
            line,
            message: `${item.kind} has an untyped child; skipped.`,
          });
        continue;
      }
      const childSource = innerNode?.children?.[index];
      if (childSource) {
        const converted = convert(child, childSource, depth + 1);
        converted.attributes.sourceIndex = index;
        node.children.push(converted);
      }
    }
    return node;
  }

  return createParseResult(convert(data, tree, 0), count, diagnostics);
}

function attributesFromJson(node) {
  const attrs = {
    format: "json",
    type: node.type?.qualType || null,
    value: node.value ?? null,
    operator: node.opcode || null,
    position: node.isPostfix ? "postfix" : "prefix",
    name: node.referencedDecl?.name || node.name || null,
    member: node.name || null,
    arrow: Boolean(node.isArrow),
    targetType: node.targetType || node.type?.qualType || null,
    isArray: Boolean(node.isArray),
    isGlobal: Boolean(node.isGlobal),
    init: node.init || null,
  };
  if (node.kind === "StringLiteral" && attrs.value !== null) {
    const value = String(attrs.value);
    attrs.value = /^"(?:\\.|[^"\\])*"$/.test(value)
      ? value
      : JSON.stringify(value);
  }
  return attrs;
}
