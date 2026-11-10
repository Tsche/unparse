/**
 * Optional backend: wasm-fmt's Clang Format Vite entry point.
 * Keep this isolated so the AST parser/emitter has no dependencies on WASM.
 * Not loaded until the user actually requests formatting.
 */
let formatterPromise;

async function loadFormatter() {
  if (!formatterPromise) {
    formatterPromise = import("@wasm-fmt/clang-format/vite").then(
      async (module) => {
        await module.default();
        return module.format;
      },
    );
  }
  return formatterPromise;
}

export async function formatCpp(
  source,
  { style = "LLVM", columnLimit = 80, indentWidth = 2, customConfig = "" } = {},
) {
  const format = await loadFormatter();
  const config =
    customConfig ||
    JSON.stringify({
      BasedOnStyle: style,
      ColumnLimit: columnLimit,
      IndentWidth: indentWidth,
    });
  // Clang-format is a token formatter. Adding a semicolon provides a well-formed
  // expression-statement context, then remove that single added semicolon.
  const formatted = format(`${source};\n`, "reconstructed.cc", config).trim();
  return formatted.endsWith(";") ? formatted.slice(0, -1).trimEnd() : formatted;
}
