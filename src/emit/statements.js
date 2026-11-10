function statement(node, context, index) {
  const child = node.children[index];
  if (!child) return context.child(node, index);
  const value = context.print(child);
  return /Stmt$/.test(child.kind) || child.kind === "DeclStmt"
    ? value
    : `${value};`;
}

function indexedChild(node, context, index) {
  const child =
    node.children.find((item) => item.attributes.sourceIndex === index) ||
    (node.attributes.format === "json" ? null : node.children[index]);
  return child ? context.print(child) : "";
}

export const statementHandlers = {
  CompoundStmt(node, context) {
    return `{\n${node.children.map((_, index) => statement(node, context, index)).join("\n")}\n}`;
  },
  ReturnStmt(node, context) {
    return node.children.length
      ? `return ${context.child(node, 0)};`
      : "return;";
  },
  DeclStmt(node, context) {
    return node.children.map((child) => context.print(child)).join("\n");
  },
  IfStmt(node, context) {
    if (!context.need(node, 2)) return "/* malformed if statement */";
    const condition = context.child(node, 0);
    const thenBranch = statement(node, context, 1);
    const elseBranch = node.children[2]
      ? ` else ${statement(node, context, 2)}`
      : "";
    return `if (${condition}) ${thenBranch}${elseBranch}`;
  },
  WhileStmt(node, context) {
    if (!context.need(node, 2)) return "/* malformed while statement */";
    return `while (${context.child(node, 0)}) ${statement(node, context, 1)}`;
  },
  DoStmt(node, context) {
    if (!context.need(node, 2)) return "/* malformed do statement */";
    return `do ${statement(node, context, 0)} while (${context.child(node, 1)});`;
  },
  BreakStmt() {
    return "break;";
  },
  ContinueStmt() {
    return "continue;";
  },
  NullStmt() {
    return ";";
  },
  ForStmt(node, context) {
    const init = indexedChild(node, context, 0).replace(/;\s*$/, "");
    const condition = indexedChild(node, context, 2);
    const increment = indexedChild(node, context, 3);
    const body =
      node.children.find((child) => child.attributes.sourceIndex === 4) ||
      (node.attributes.format === "json" ? null : node.children.at(-1));
    if (!body) context.warn(node, "ForStmt is missing its body.");
    return `for (${init}; ${condition}; ${increment}) ${body ? context.print(body) : "/* body? */"}`;
  },
  SwitchStmt(node, context) {
    if (!context.need(node, 2)) return "/* malformed switch statement */";
    return `switch (${context.child(node, 0)}) ${context.child(node, 1)}`;
  },
  CaseStmt(node, context) {
    if (!context.need(node, 2)) return "/* malformed case statement */";
    return `case ${context.child(node, 0)}: ${statement(node, context, node.children.length - 1)}`;
  },
  DefaultStmt(node, context) {
    return `default: ${statement(node, context, 0)}`;
  },
  LabelStmt(node, context) {
    return `${node.attributes.name || "/* label? */"}: ${statement(node, context, 0)}`;
  },
  GotoStmt(node) {
    return `goto ${node.attributes.name || "/* label? */"};`;
  },
};
