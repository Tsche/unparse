export const literalHandlers = {
  CXXBoolLiteralExpr(node, context) {
    if (node.attributes.value === null)
      context.warn(node, "Boolean literal value is missing.");
    return String(node.attributes.value ?? "false");
  },
  IntegerLiteral(node, context) {
    if (node.attributes.value === null)
      context.warn(node, "Integer literal value is missing.");
    return String(node.attributes.value ?? "0");
  },
  FloatingLiteral(node, context) {
    if (node.attributes.value === null)
      context.warn(node, "Floating literal value is missing.");
    return String(node.attributes.value ?? "0.0");
  },
  StringLiteral(node, context) {
    if (node.attributes.value === null)
      context.warn(node, "String literal spelling not found.");
    return node.attributes.value || '"/* missing string */"';
  },
  CXXNullPtrLiteralExpr() {
    return "nullptr";
  },
  CharacterLiteral(node, context) {
    if (node.attributes.value === null)
      context.warn(node, "Character literal value is missing.");
    const value = node.attributes.value;
    if (typeof value === "number") {
      if (!Number.isInteger(value) || value < 0 || value > 0x10ffff) {
        context.warn(node, "Character literal code point is invalid.");
        return "'?'";
      }
      const character = String.fromCodePoint(value);
      const escaped =
        { "\n": "\\n", "\r": "\\r", "\t": "\\t", "\0": "\\0" }[character] ||
        character.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      return `'${escaped}'`;
    }
    return String(value ?? "'?'");
  },
  GNUNullExpr() {
    return "__null";
  },
};
