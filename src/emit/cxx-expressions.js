const wrapper = (node, context) => context.child(node, 0);
const argumentsFrom = (node, context, start = 0) =>
  node.children
    .slice(start)
    .map((child) => context.print(child))
    .join(", ");

export const cxxExpressionHandlers = {
  CXXMemberCallExpr(node, context) {
    return `${context.child(node, 0)}(${argumentsFrom(node, context, 1)})`;
  },
  CXXOperatorCallExpr(node, context) {
    return `${context.child(node, 0)}(${argumentsFrom(node, context, 1)})`;
  },
  CXXConstructExpr(node, context) {
    return `${node.attributes.type || "/* type? */"}(${argumentsFrom(node, context)})`;
  },
  CXXTemporaryObjectExpr(node, context) {
    return cxxExpressionHandlers.CXXConstructExpr(node, context);
  },
  InitListExpr(node, context) {
    return `{${argumentsFrom(node, context)}}`;
  },
  CXXStdInitializerListExpr: wrapper,
  CXXDefaultArgExpr: wrapper,
  CXXDefaultInitExpr: wrapper,
  CXXParenListInitExpr(node, context) {
    return `(${argumentsFrom(node, context)})`;
  },
  ParenListExpr(node, context) {
    return `(${argumentsFrom(node, context)})`;
  },
  CXXScalarValueInitExpr(node) {
    return `${node.attributes.type || "/* type? */"}{}`;
  },
  CXXNewExpr(node, context) {
    const type =
      node.attributes.type?.replace(/\s*\*\s*$/, "") || "/* type? */";
    const count = node.attributes.isArray ? `[${context.child(node, 0)}]` : "";
    const initStart = node.attributes.isArray ? 1 : 0;
    const init =
      node.children.length > initStart
        ? `(${argumentsFrom(node, context, initStart)})`
        : "";
    return `new ${type}${count}${init}`;
  },
  CXXDeleteExpr(node, context) {
    return `delete${node.attributes.isArray ? "[]" : ""} ${context.child(node, 0)}`;
  },
  CXXThrowExpr(node, context) {
    return node.children.length ? `throw ${context.child(node, 0)}` : "throw";
  },
  CXXNoexceptExpr(node, context) {
    return `noexcept(${context.child(node, 0)})`;
  },
  UnaryExprOrTypeTraitExpr(node, context) {
    const name = node.raw?.name || "sizeof";
    const argument =
      node.raw?.argType?.qualType ||
      (node.children.length ? context.child(node, 0) : node.attributes.type);
    return `${name}(${argument || "/* operand? */"})`;
  },
  CompoundLiteralExpr(node, context) {
    return `(${node.attributes.type || "/* type? */"})${context.child(node, 0)}`;
  },
};
