# AST → C++

A browser workspace for exploring Clang `-ast-dump` text or `-ast-dump=json` trees and reconstructing approximate C++ expressions. Formatting runs locally through `@wasm-fmt/clang-format` WebAssembly. Pasted input stays in the browser.

The reconstruction is deliberately best-effort. AST dumps can omit macro spelling and other source details; unsupported node kinds produce explicit notes while keeping their descendants visible.

## Run

```sh
npm install
npm run dev
```

Open the URL printed by Vite. The production site is built with `npm run build` and can be served with `npm run preview` or deployed as static files from `dist/`.

## Workspace

- Choose **Text AST** or **Clang JSON** in each input pane.
- Use **Add input** to create another input. Each input can open one linked C++ output from its pane header.
- Drag anywhere on a pane header except its buttons onto another pane's highlighted edge to dock it left, right, above, or below. Use the pencil button to rename a pane.
- Drag a divider to resize immediately. Dividers also support arrow keys and double-click to reset.
- On narrow screens, pane tabs give each pane the available width.
- Use **Share** in the top bar to copy a compressed link containing the pane layout, input text, names, and output formatting settings. Opening the link restores that view without a shortening service. Large workspaces can still produce long links.
- Each input pane has its own text/JSON example picker and input-kind selector. Switching kind attempts to convert the current tree; JSON-only details can be omitted when converting to text. Output formatting is on by default; Settings accepts quick controls or full `.clang-format` YAML/JSON.
- Hover an AST line to highlight its generated output. Error and inference icons show explanations on hover. Nodes that add no syntax of their own are dimmed.

## Test and CLI

```sh
npm test
npm run build
npm run test:e2e
npm run convert -- examples/assert-ast.txt
```

The browser test uses Playwright Chromium. Install the browser once with `npx playwright install chromium`; some Linux systems also need `npx playwright install-deps chromium`.

The CLI and unit tests use Node.js. `.github/workflows/ci.yml` runs formatting, unit tests, the build, and Chromium browser tests on pushes and pull requests. The Pages workflow runs the same checks before deploying from `main` or `master`. For GitHub Pages, set **Build and deployment → Source** to **GitHub Actions**.

