/** Extract fields once, at the text adapter boundary. */
export function attributesFromText(kind, metadata) {
  const quoted = [...metadata.matchAll(/'([^']*)'/g)].map((match) => match[1]);
  const type = quoted[0] || null;
  const attrs = { format: "text", type };
  if (
    /^(?:FunctionDecl|VarDecl|ParmVarDecl|FieldDecl|TypedefDecl|TypeAliasDecl|NamespaceDecl|CXXRecordDecl|RecordDecl|LabelStmt|GotoStmt)$/.test(
      kind,
    )
  ) {
    attrs.name =
      metadata.match(/(?:^|\s)([A-Za-z_]\w*)\s+'[^']*'\s*$/)?.[1] ||
      metadata.match(/(?:^|\s)([A-Za-z_]\w*)\s*$/)?.[1] ||
      null;
  }
  if (kind === "BinaryOperator")
    attrs.operator = quoted.length > 1 ? quoted.at(-1) : null;
  if (kind === "UnaryOperator") {
    const match = metadata.match(/\b(prefix|postfix)\s+'([^']+)'/);
    attrs.position = match?.[1] || null;
    attrs.operator = match?.[2] || null;
  }
  if (kind === "DeclRefExpr") {
    attrs.name =
      metadata.match(
        /\b(?:Function|FunctionTemplate|CXXMethod|Var|ParmVar|EnumConstant|NonTypeTemplateParm|Binding|Field|UsingShadow)\s+(?:0x[0-9a-fA-F]+\s+)?'([^']+)'/,
      )?.[1] || null;
  }
  if (kind === "MemberExpr") {
    const match = metadata.match(/(->|\.)([A-Za-z_]\w*)\b/);
    attrs.member = match?.[2] || null;
    attrs.arrow = match?.[1] === "->";
  }
  if (kind === "IntegerLiteral")
    attrs.value =
      metadata.match(/\s(-?(?:0[xX][0-9A-Fa-f]+|\d+)[uUlL]*)\s*$/)?.[1] || null;
  if (kind === "FloatingLiteral")
    attrs.value =
      metadata.match(
        /\s(-?(?:\d+\.?\d*|\.\d+)(?:[eEpP][+-]?\d+)?[fFlL]?)\s*$/,
      )?.[1] || null;
  if (kind === "CXXBoolLiteralExpr")
    attrs.value = metadata.match(/\b(true|false)\s*$/)?.[1] || null;
  if (kind === "StringLiteral")
    attrs.value =
      [...metadata.matchAll(/"(?:\\.|[^"\\])*"/g)].at(-1)?.[0] || null;
  if (kind === "PredefinedExpr")
    attrs.name =
      metadata.match(/\b(__PRETTY_FUNCTION__|__FUNCTION__|__func__)\b/)?.[1] ||
      null;
  if (kind.startsWith("CXX") && kind.endsWith("CastExpr")) {
    const castName = {
      CXXStaticCastExpr: "static_cast",
      CXXDynamicCastExpr: "dynamic_cast",
      CXXReinterpretCastExpr: "reinterpret_cast",
      CXXConstCastExpr: "const_cast",
    }[kind];
    attrs.targetType = castName
      ? metadata.match(new RegExp(`${castName}<([^>]+)>`))?.[1] || type
      : type;
  }
  if (kind === "CXXFunctionalCastExpr")
    attrs.targetType =
      metadata.match(/functional cast to\s+(.+?)(?=\s+<|$)/)?.[1]?.trim() ||
      type;
  return attrs;
}
