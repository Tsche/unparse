const validOperators = new Set([
  "+",
  "-",
  "*",
  "/",
  "%",
  "<",
  ">",
  "<=",
  ">=",
  "==",
  "!=",
  "&&",
  "||",
  "&",
  "|",
  "^",
  "<<",
  ">>",
  "=",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "&=",
  "|=",
  "^=",
  "<<=",
  ">>=",
  ",",
  "->*",
  ".*",
]);

export const expressionHandlers = {
  ConditionalOperator(node, context) {
    if (!context.need(node, 3)) return "/* malformed conditional expression */";
    return `(${context.child(node, 0)} ? ${context.child(node, 1)} : ${context.child(node, 2)})`;
  },
  BinaryOperator(node, context) {
    const operator = node.attributes.operator;
    if (!validOperators.has(operator))
      context.warn(node, "BinaryOperator is missing its operator spelling.");
    if (!context.need(node, 2)) return "/* malformed binary expression */";
    return `(${context.child(node, 0)} ${validOperators.has(operator) ? operator : "/* op? */"} ${context.child(node, 1)})`;
  },
  CompoundAssignOperator(node, context) {
    return expressionHandlers.BinaryOperator(node, context);
  },
  CXXRewrittenBinaryOperator(node, context) {
    return expressionHandlers.BinaryOperator(node, context);
  },
  UnaryOperator(node, context) {
    const operator = node.attributes.operator;
    if (!operator)
      context.warn(
        node,
        "UnaryOperator is missing its position/operator spelling.",
      );
    const operand = context.child(node, 0);
    if (operator === "__extension__") return `__extension__ ${operand}`;
    if (node.attributes.position === "postfix")
      return `(${operand}${operator || "/* op? */"})`;
    return `(${operator || "/* op? */"}${operand})`;
  },
  CallExpr(node, context) {
    if (!context.need(node, 1)) return "/* malformed function call */";
    return `${context.child(node, 0)}(${node.children
      .slice(1)
      .map((child) => context.print(child))
      .join(", ")})`;
  },
  UserDefinedLiteral(node, context) {
    return expressionHandlers.CallExpr(node, context);
  },
  BinaryConditionalOperator(node, context) {
    if (!context.need(node, 2)) return "/* malformed conditional expression */";
    return `(${context.child(node, 0)} ?: ${context.child(node, 1)})`;
  },
  ChooseExpr(node, context) {
    if (!context.need(node, 3)) return "/* malformed choose expression */";
    return `__builtin_choose_expr(${node.children.map((child) => context.print(child)).join(", ")})`;
  },
  DeclRefExpr(node, context) {
    const name = node.attributes.name;
    if (!name)
      context.warn(node, "Couldn't extract the referenced declaration's name.");
    return name || "/* unknown identifier */";
  },
  MemberExpr(node, context) {
    const member = node.attributes.member;
    if (!member) context.warn(node, "Couldn't determine member access/name.");
    return `${context.child(node, 0)}${node.attributes.arrow ? "->" : "."}${member || "/* member? */"}`;
  },
  ArraySubscriptExpr(node, context) {
    if (!context.need(node, 2)) return "/* malformed subscript */";
    return `${context.child(node, 0)}[${context.child(node, 1)}]`;
  },
  CXXThisExpr() {
    return "this";
  },
  SourceLocExpr(node, context) {
    const type = node.attributes.type;
    context.warn(
      node,
      `SourceLocExpr builtin inferred from type ${JSON.stringify(type)}, not encoded in the dump.`,
    );
    if (type === "unsigned int") return "__builtin_LINE()";
    if (type === "const char *") return "__builtin_FILE()";
    return "/* unknown source-location builtin */";
  },
  PredefinedExpr(node, context) {
    const name = node.attributes.name;
    if (!name)
      context.warn(node, "Couldn't identify the predefined expression kind.");
    return name || "/* unknown predefined expression */";
  },
};
