const namedCasts = {
  CXXStaticCastExpr: "static_cast",
  CXXDynamicCastExpr: "dynamic_cast",
  CXXReinterpretCastExpr: "reinterpret_cast",
  CXXConstCastExpr: "const_cast",
};

export const castHandlers = {
  CXXFunctionalCastExpr(node, context) {
    const type = node.attributes.targetType;
    if (!type) context.warn(node, "Functional cast target type is missing.");
    return `${type || "/* type? */"}(${context.child(node, 0)})`;
  },
  CStyleCastExpr(node, context) {
    const type = node.attributes.targetType || node.attributes.type;
    if (!type) context.warn(node, "Cast target type is missing.");
    return `(${type || "/* type? */"})(${context.child(node, 0)})`;
  },
};
for (const [kind, name] of Object.entries(namedCasts)) {
  castHandlers[kind] = (node, context) => {
    const type = node.attributes.targetType;
    if (!type) context.warn(node, "Cast target type is missing.");
    return `${name}<${type || "/* type? */"}>(${context.child(node, 0)})`;
  };
}
