const wrapper = (node, context) =>
  context.need(node, 1) ? context.child(node, 0) : "/* missing operand */";

export const structuralHandlers = {
  ParenExpr(node, context) {
    return context.need(node, 1)
      ? `(${context.child(node, 0)})`
      : "(/* missing operand */)";
  },
  ImplicitCastExpr: wrapper,
  ConstantExpr: wrapper,
  ExprWithCleanups: wrapper,
  MaterializeTemporaryExpr: wrapper,
  CXXBindTemporaryExpr: wrapper,
  FullExpr: wrapper,
  OpaqueValueExpr: wrapper,
  PseudoObjectExpr: wrapper,
  ArrayInitLoopExpr: wrapper,
  ArrayInitIndexExpr: wrapper,
  ImplicitValueInitExpr(node) {
    return `${node.attributes.type || "/* type? */"}{}`;
  },
  NoInitExpr() {
    return "{}";
  },
  StmtExpr(node, context) {
    return `(${context.child(node, 0)})`;
  },
};
