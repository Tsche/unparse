import { parseAst } from "./index.js";

/** Convert an input through the normalized AST model. */
export function convertAst(input, from, to) {
  if (from === to) return input;
  const { root } = parseAst(input, from);
  if (to === "json") return JSON.stringify(toJsonNode(root), null, 2);
  if (to === "text") return toTextAst(root);
  throw new Error(`Unknown AST input format: ${to}.`);
}

export function toJsonNode(node, { preserveTextMetadata = true } = {}) {
  if (
    node.attributes.format === "json" &&
    node.raw &&
    typeof node.raw === "object"
  ) {
    return structuredClone(node.raw);
  }
  const attrs = node.attributes;
  const result = { kind: node.kind };
  if (attrs.type) result.type = { qualType: attrs.type };
  if (attrs.value !== null && attrs.value !== undefined)
    result.value = attrs.value;
  if (attrs.operator) result.opcode = attrs.operator;
  if (attrs.position === "postfix") result.isPostfix = true;
  if (node.kind === "DeclRefExpr" && attrs.name) {
    result.referencedDecl = { kind: "VarDecl", name: attrs.name };
  } else if (attrs.name) {
    result.name = attrs.name;
  }
  if (node.kind === "MemberExpr" && attrs.member) result.name = attrs.member;
  if (attrs.arrow) result.isArrow = true;
  if (attrs.targetType) result.targetType = attrs.targetType;
  if (preserveTextMetadata && node.metadata)
    result.unparseTextMetadata = node.metadata;
  if (node.children.length) {
    result.inner = node.children.map((child) =>
      toJsonNode(child, { preserveTextMetadata }),
    );
  }
  return result;
}

export function toTextAst(root) {
  const lines = [];
  function visit(node, prefix = "", branch = "") {
    const metadata = textMetadata(node);
    lines.push(
      `${prefix}${branch}${node.kind}${metadata ? ` ${metadata}` : ""}`,
    );
    const nextPrefix = branch
      ? `${prefix}${branch === "|-" ? "| " : "  "}`
      : "";
    node.children.forEach((child, index) => {
      visit(
        child,
        nextPrefix,
        index === node.children.length - 1 ? "`-" : "|-",
      );
    });
  }
  visit(root);
  return lines.join("\n");
}

function textMetadata(node) {
  if (node.metadata) return node.metadata;
  if (node.raw?.unparseTextMetadata) return node.raw.unparseTextMetadata;
  const attrs = node.attributes;
  const parts = [];
  if (attrs.type) parts.push(`'${attrs.type}'`);
  if (node.kind === "BinaryOperator" && attrs.operator)
    parts.push(`'${attrs.operator}'`);
  if (node.kind === "UnaryOperator" && attrs.operator) {
    parts.push(`${attrs.position || "prefix"} '${attrs.operator}'`);
  }
  if (node.kind === "DeclRefExpr" && attrs.name)
    parts.push(`Var '${attrs.name}'`);
  if (node.kind === "MemberExpr" && attrs.member)
    parts.push(`${attrs.arrow ? "->" : "."}${attrs.member}`);
  if (
    [
      "IntegerLiteral",
      "FloatingLiteral",
      "CXXBoolLiteralExpr",
      "StringLiteral",
    ].includes(node.kind) &&
    attrs.value !== null &&
    attrs.value !== undefined
  ) {
    parts.push(String(attrs.value));
  }
  if (node.kind === "PredefinedExpr" && attrs.name) parts.push(attrs.name);
  const cast = {
    CXXStaticCastExpr: "static_cast",
    CXXDynamicCastExpr: "dynamic_cast",
    CXXReinterpretCastExpr: "reinterpret_cast",
    CXXConstCastExpr: "const_cast",
  }[node.kind];
  if (cast && attrs.targetType) parts.push(`${cast}<${attrs.targetType}>`);
  if (node.kind === "CXXFunctionalCastExpr" && attrs.targetType)
    parts.push(`functional cast to ${attrs.targetType}`);
  return parts.join(" ");
}
