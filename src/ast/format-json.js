/** Compact Clang metadata objects while keeping AST children on separate lines. */
export function formatJsonAst(input) {
  const data = JSON.parse(input);
  function render(value, depth) {
    const indent = "  ".repeat(depth);
    if (value === null || typeof value !== "object")
      return JSON.stringify(value);
    if (Array.isArray(value)) {
      if (!value.length) return "[]";
      return `[\n${value.map((item) => `${indent}  ${render(item, depth + 1)}`).join(",\n")}\n${indent}]`;
    }
    const entries = Object.entries(value);
    if (!entries.length) return "{}";
    if (!Object.hasOwn(value, "inner")) {
      const compact = JSON.stringify(value);
      if (compact.length <= 96) return compact;
    }
    return `{\n${entries.map(([key, item]) => `${indent}  ${JSON.stringify(key)}: ${render(item, depth + 1)}`).join(",\n")}\n${indent}}`;
  }
  return render(data, 0) + "\n";
}
