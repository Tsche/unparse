import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "playwright";

const server = await createServer({ server: { host: "127.0.0.1", port: 0 } });
await server.listen();
const port = server.httpServer.address().port;
const browser = await chromium.launch({ headless: true });

async function dragPane(page, sourceId, targetId, edge) {
  const header = page.locator(`[data-pane-id="${sourceId}"] .pane-header`);
  const start = await header.boundingBox();
  await page.mouse.move(start.x + 50, start.y + 16);
  await page.mouse.down();
  await page.mouse.move(start.x + 115, start.y + 25, { steps: 5 });
  await page
    .locator(`[data-pane-id="${targetId}"] .drop-overlay`)
    .waitFor({ state: "visible" });
  const drop = await page
    .locator(`[data-pane-id="${targetId}"] [data-edge="${edge}"]`)
    .boundingBox();
  await page.mouse.move(drop.x + drop.width / 2, drop.y + drop.height / 2, {
    steps: 10,
  });
  await page.mouse.up();
}

try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/`);
  await page
    .locator(".cpp-output")
    .getByText("__assert_fail", { exact: false })
    .waitFor();
  assert.equal(await page.locator(".pane").count(), 2);
  assert.equal(
    await page.locator(".source-select, .dock-select, #add-output").count(),
    0,
  );
  assert.equal(
    await page.locator(".notes .diagnostic-count").textContent(),
    "2 warnings",
  );

  await page.locator('[data-pane-id="pane-1"] .rename-pane').click();
  await page
    .locator('[data-pane-id="pane-1"] .pane-title-edit')
    .fill("Main AST");
  await page.locator('[data-pane-id="pane-1"] .pane-title-edit').press("Enter");
  assert.equal(
    await page.locator('[data-pane-id="pane-1"] .pane-title').textContent(),
    "Main AST",
  );
  assert.ok(
    (await page.locator(".mobile-tabs").textContent()).includes("Main AST"),
  );

  await page.locator('[data-pane-id="pane-2"] .rename-pane').click();
  await page
    .locator('[data-pane-id="pane-2"] .pane-title-edit')
    .fill("Reconstructed C++");
  await page.locator('[data-pane-id="pane-2"] .pane-title-edit').press("Enter");
  assert.equal(
    await page.locator('[data-pane-id="pane-2"] .pane-title').textContent(),
    "Reconstructed C++",
  );

  const firstInput = page.locator('[data-pane-id="pane-1"] .ast-input');
  const original = await firstInput.inputValue();
  await page
    .locator('[data-pane-id="pane-1"] .input-kind')
    .selectOption("json");
  assert.ok((await firstInput.inputValue()).startsWith("{"));
  assert.equal(
    await page
      .locator(
        '[data-pane-id="pane-1"] .example-select option[value="assert-ast.json"]',
      )
      .count(),
    1,
  );
  await page
    .locator('[data-pane-id="pane-1"] .input-kind')
    .selectOption("text");
  assert.ok((await firstInput.inputValue()).startsWith("ParenExpr"));
  const typoAt = original.lastIndexOf("StringLiteral");
  await firstInput.fill(
    original.slice(0, typoAt) +
      "StringLieral" +
      original.slice(typoAt + "StringLiteral".length),
  );
  await page
    .locator('[data-pane-id="pane-1"] .ast-line.error-node .token-error')
    .getByText("StringLieral")
    .waitFor();
  await firstInput.fill(original);
  await firstInput.fill("@broken");
  await page
    .locator('[data-pane-id="pane-1"] .input-kind')
    .selectOption("json");
  assert.equal(
    await page.locator('[data-pane-id="pane-1"] .input-kind').inputValue(),
    "text",
  );
  assert.equal(await firstInput.inputValue(), "@broken");
  assert.match(
    await page.locator('[data-pane-id="pane-1"] .input-status').textContent(),
    /Could not convert input/,
  );
  await firstInput.fill(original);

  const outputCopy = page.locator('[data-pane-id="pane-2"] .copy-button');
  assert.equal(
    await outputCopy.evaluate((button) => getComputedStyle(button).opacity),
    "0",
  );
  await page.locator('[data-pane-id="pane-2"] .output-code').hover();
  await page.waitForFunction(
    () =>
      getComputedStyle(
        document.querySelector('[data-pane-id="pane-2"] .copy-button'),
      ).opacity !== "0",
  );
  await page.locator('[data-pane-id="pane-2"] .settings-menu summary').click();
  await outputCopy.waitFor({ state: "hidden" });
  await page.locator('[data-pane-id="pane-2"] .settings-menu summary').click();

  const divider = page.locator(".dock-divider").first();
  const before = await divider.boundingBox();
  await page.mouse.move(before.x + 4, before.y + 100);
  await page.mouse.down();
  await page.mouse.move(before.x + 170, before.y + 100, { steps: 3 });
  await page.mouse.up();
  const after = await divider.boundingBox();
  assert.ok(after.x > before.x + 100, "divider moves during pointer drag");

  await dragPane(page, "pane-2", "pane-1", "bottom");
  assert.equal(await page.locator(".dock-split.column").count(), 1);
  await dragPane(page, "pane-2", "pane-1", "right");
  assert.equal(await page.locator(".dock-split.column").count(), 0);

  await page.getByRole("button", { name: "Add input" }).click();
  assert.equal(await page.locator(".input-pane").count(), 2);
  assert.equal(await page.locator(".output-pane").count(), 1);
  await page
    .locator('[data-pane-id="pane-3"] .input-kind')
    .selectOption("json");
  await page.locator('[data-pane-id="pane-3"] .ast-input').fill(
    JSON.stringify(
      {
        kind: "BinaryOperator",
        opcode: "+",
        inner: [
          { kind: "IntegerLiteral", value: "8" },
          { kind: "IntegerLiteral", value: "5" },
        ],
      },
      null,
      2,
    ),
  );
  await page.locator('[data-pane-id="pane-3"] .open-output').click();
  assert.equal(await page.locator(".output-pane").count(), 2);
  assert.equal(
    await page.locator('[data-pane-id="pane-3"] .open-output:visible').count(),
    0,
  );
  await page.waitForFunction(() =>
    document
      .querySelector('[data-pane-id="pane-4"] .cpp-output')
      ?.textContent?.includes("(8 + 5)"),
  );
  assert.ok(
    await page
      .locator('[data-pane-id="pane-3"] .ast-highlight .token-type')
      .count(),
    "JSON keys receive syntax colors",
  );
  await page
    .locator('[data-pane-id="pane-4"] .cpp-output [data-node="1"]')
    .first()
    .hover();
  assert.ok(
    await page
      .locator('[data-pane-id="pane-3"] .ast-line.linked-active')
      .count(),
    "output hover maps back to the JSON object",
  );
  await page.locator('[data-pane-id="pane-3"] .format-json').click();
  assert.match(
    await page.locator('[data-pane-id="pane-3"] .ast-input').inputValue(),
    /"kind": "BinaryOperator"/,
  );
  await page
    .locator('[data-pane-id="pane-3"] .example-select')
    .selectOption("arithmetic-ast.json");
  await page.waitForFunction(() =>
    document
      .querySelector('[data-pane-id="pane-4"] .cpp-output')
      ?.textContent?.includes("2 +"),
  );
  assert.ok(
    (
      await page.locator('[data-pane-id="pane-2"] .cpp-output').textContent()
    ).includes("__assert_fail"),
  );
  await page.locator('[data-pane-id="pane-3"] .rename-pane').click();
  await page
    .locator('[data-pane-id="pane-3"] .pane-title-edit')
    .fill("Shared JSON");
  await page.locator('[data-pane-id="pane-3"] .pane-title-edit').press("Enter");
  await page.locator('[data-pane-id="pane-4"] .format-toggle').uncheck();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const sharedUrl = await page.locator("#share-url").inputValue();
  assert.ok(sharedUrl.includes("?s="));
  assert.ok(
    sharedUrl.length < 8000,
    "example workspace produces a practical URL",
  );
  const shared = await browser.newPage({
    viewport: { width: 1200, height: 800 },
  });
  shared.on("pageerror", (error) => errors.push(error.message));
  await shared.goto(sharedUrl);
  assert.equal(await shared.locator(".pane").count(), 4);
  assert.equal(
    await shared.locator('[data-pane-id="pane-3"] .pane-title').textContent(),
    "Shared JSON",
  );
  assert.equal(
    await shared.locator('[data-pane-id="pane-3"] .input-kind').inputValue(),
    "json",
  );
  assert.equal(
    await shared.locator('[data-pane-id="pane-3"] .ast-input').inputValue(),
    await page.locator('[data-pane-id="pane-3"] .ast-input').inputValue(),
  );
  assert.equal(
    await shared.locator('[data-pane-id="pane-4"] .format-toggle').isChecked(),
    false,
  );
  assert.equal(
    await shared.locator(".dock-split.row").count(),
    await page.locator(".dock-split.row").count(),
  );
  assert.equal(
    await shared.locator(".dock-split.column").count(),
    await page.locator(".dock-split.column").count(),
  );
  await Promise.all([
    shared.waitForNavigation(),
    shared.getByRole("link", { name: "Reload site" }).click(),
  ]);
  assert.equal(await shared.locator(".pane").count(), 4);
  assert.equal(
    await shared.locator('[data-pane-id="pane-3"] .pane-title').textContent(),
    "Shared JSON",
  );
  await Promise.all([
    shared.waitForNavigation(),
    shared.getByRole("button", { name: "Reset UI" }).click(),
  ]);
  assert.equal(new URL(shared.url()).searchParams.has("s"), false);
  assert.equal(await shared.locator(".pane").count(), 2);
  await shared
    .locator(".cpp-output")
    .getByText("__assert_fail", { exact: false })
    .waitFor();
  await shared.close();
  const sharedMobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await sharedMobile.goto(sharedUrl);
  assert.equal(await sharedMobile.locator(".pane:visible").count(), 1);
  assert.equal(
    await sharedMobile.locator('.pane[data-pane-id="pane-4"]:visible').count(),
    1,
  );
  await sharedMobile.close();
  const broken = await browser.newPage();
  await broken.goto(`http://127.0.0.1:${port}/?s=broken!`);
  assert.match(
    await broken.locator("#share-status").textContent(),
    /Could not restore link/,
  );
  await broken.locator(".pane").first().waitFor();
  await broken.close();
  await page.locator('[data-pane-id="pane-4"] .pane-close').click();
  assert.equal(
    await page.locator('[data-pane-id="pane-3"] .open-output').textContent(),
    "Open output",
  );

  await page.locator(".about-menu summary").click();
  assert.equal(await page.locator(".about-panel:visible").count(), 1);
  assert.equal(
    await page.locator('.about-panel a[href$="LLVM.txt"]').count(),
    1,
  );
  assert.deepEqual(errors, []);

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  mobile.on("pageerror", (error) => errors.push(error.message));
  await mobile.goto(`http://127.0.0.1:${port}/`);
  await mobile.getByRole("button", { name: "Share", exact: true }).click();
  const shareBounds = await mobile.locator("#share-panel").boundingBox();
  assert.ok(shareBounds.x >= 0 && shareBounds.x + shareBounds.width <= 390);
  await mobile.getByRole("button", { name: "Share", exact: true }).click();
  await mobile
    .locator(".cpp-output")
    .getByText("__assert_fail", { exact: false })
    .waitFor({ state: "attached" });
  assert.equal(await mobile.locator(".pane:visible").count(), 1);
  await mobile.locator(".mobile-tabs button").nth(1).click();
  assert.equal(await mobile.locator(".output-pane:visible").count(), 1);
  await mobile.getByRole("button", { name: "Add input" }).click();
  assert.equal(await mobile.locator(".mobile-tabs button").count(), 3);
  assert.equal(await mobile.locator(".input-pane:visible").count(), 1);
  await mobile.locator('[data-pane-id="pane-3"] .open-output').click();
  assert.equal(await mobile.locator(".mobile-tabs button").count(), 4);
  assert.equal(await mobile.locator(".output-pane:visible").count(), 1);
  assert.ok(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  );
  assert.deepEqual(errors, []);
  console.log("Browser workspace checks passed (desktop and mobile).");
} finally {
  await browser.close();
  await server.close();
}
