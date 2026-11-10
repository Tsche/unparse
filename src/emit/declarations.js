function joinDeclarations(node, context) {
  return node.children
    .filter((child) => !child.raw?.isImplicit)
    .map((child) => context.print(child))
    .filter(Boolean)
    .join("\n");
}

function declarationType(node, context) {
  const type = node.attributes.type;
  if (!type) context.warn(node, `${node.kind} is missing its declared type.`);
  return type || "/* type? */";
}

function namedDeclaration(node, context, suffix = "") {
  const name = node.attributes.name;
  if (!name) context.warn(node, `${node.kind} is missing its name.`);
  return `${declarationType(node, context)} ${name || "/* name? */"}${suffix}`;
}

export const declarationHandlers = {
  TranslationUnitDecl: joinDeclarations,
  LinkageSpecDecl: joinDeclarations,
  ExternCContextDecl: joinDeclarations,
  ParmVarDecl(node, context) {
    return namedDeclaration(node, context);
  },
  VarDecl(node, context) {
    const initializer = node.children[0] ? ` = ${context.child(node, 0)}` : "";
    return `${namedDeclaration(node, context, initializer)};`;
  },
  FieldDecl(node, context) {
    return `${namedDeclaration(node, context)};`;
  },
  FunctionDecl(node, context) {
    const type = declarationType(node, context);
    const name = node.attributes.name || "/* name? */";
    const returnType = type.includes("(")
      ? type.slice(0, type.indexOf("(")).trim()
      : type;
    const params = node.children.filter(
      (child) => child.kind === "ParmVarDecl",
    );
    const body = node.children.find((child) => child.kind === "CompoundStmt");
    const signature = `${returnType} ${name}(${params.map((child) => context.print(child)).join(", ")})`;
    return body ? `${signature} ${context.print(body)}` : `${signature};`;
  },
  TypedefDecl(node, context) {
    return `typedef ${namedDeclaration(node, context)};`;
  },
  TypeAliasDecl(node, context) {
    return `using ${node.attributes.name || "/* name? */"} = ${declarationType(node, context)};`;
  },
  NamespaceDecl(node, context) {
    return `namespace ${node.attributes.name || ""} {\n${joinDeclarations(node, context)}\n}`;
  },
  CXXRecordDecl(node, context) {
    if (node.raw?.isImplicit) return "";
    const tag = node.raw?.tagUsed || "struct";
    const name = node.attributes.name || "";
    const members = node.children.filter((child) => !child.raw?.isImplicit);
    return members.length
      ? `${tag} ${name} {\n${members.map((child) => context.print(child)).join("\n")}\n};`
      : `${tag} ${name};`;
  },
  RecordDecl(node, context) {
    return declarationHandlers.CXXRecordDecl(node, context);
  },
  EmptyDecl() {
    return ";";
  },
};
