import { deflateSync, inflateSync, strFromU8, strToU8 } from "fflate";

const VERSION = 1;
const MAX_JSON_BYTES = 2_000_000;
const MAX_TOKEN_LENGTH = 250_000;
const STYLES = new Set([
  "LLVM",
  "Google",
  "Chromium",
  "Mozilla",
  "Microsoft",
  "GNU",
  "WebKit",
]);

function trim(values) {
  while (
    values.length &&
    (values.at(-1) === null || values.at(-1) === undefined)
  )
    values.pop();
  return values;
}

function encodeBytes(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeBytes(token) {
  if (!/^[A-Za-z0-9_-]+$/.test(token))
    throw new Error("Share link contains invalid characters.");
  const binary = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

/** Positional, versioned format: [version, panes, dock tree, active pane]. */
export function encodeShareState(snapshot) {
  const panes = snapshot.panes.map((pane) => {
    if (pane.type === "input")
      return trim([
        0,
        pane.kind === "json" ? 1 : 0,
        pane.value,
        pane.title || null,
      ]);
    const settings = trim([
      pane.format === false ? 0 : null,
      pane.style && pane.style !== "LLVM" ? pane.style : null,
      pane.columnLimit !== 80 ? pane.columnLimit : null,
      pane.indentWidth !== 2 ? pane.indentWidth : null,
      pane.customConfig || null,
    ]);
    return trim([
      1,
      pane.inputIndex,
      pane.title || null,
      settings.length ? settings : null,
    ]);
  });
  const payload = [VERSION, panes, snapshot.tree, snapshot.active ?? 0];
  const data = strToU8(JSON.stringify(payload));
  if (data.length > MAX_JSON_BYTES)
    throw new Error("Workspace is too large for a share link.");
  const token = encodeBytes(deflateSync(data, { level: 9 }));
  if (token.length > MAX_TOKEN_LENGTH)
    throw new Error("Workspace is too large for a share link.");
  return token;
}

function validTitle(value) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.length <= 60)
  );
}

function validateTree(tree, paneCount, seen, depth = 0) {
  if (depth > 16)
    throw new Error("Share link has too many nested pane splits.");
  if (Number.isInteger(tree)) {
    if (tree < 0 || tree >= paneCount || seen.has(tree))
      throw new Error("Share link has an invalid pane layout.");
    seen.add(tree);
    return;
  }
  if (
    !Array.isArray(tree) ||
    tree.length !== 4 ||
    ![0, 1].includes(tree[0]) ||
    !Number.isInteger(tree[1]) ||
    tree[1] < 15 ||
    tree[1] > 85
  )
    throw new Error("Share link has an invalid pane layout.");
  validateTree(tree[2], paneCount, seen, depth + 1);
  validateTree(tree[3], paneCount, seen, depth + 1);
}

export function decodeShareState(token) {
  if (typeof token !== "string" || !token || token.length > MAX_TOKEN_LENGTH)
    throw new Error("Share link is empty or too large.");
  let data;
  try {
    data = strFromU8(
      inflateSync(decodeBytes(token), {
        out: new Uint8Array(MAX_JSON_BYTES + 1),
      }),
    );
  } catch {
    throw new Error("Share link could not be decompressed.");
  }
  if (strToU8(data).length > MAX_JSON_BYTES)
    throw new Error("Share link is too large.");
  let payload;
  try {
    payload = JSON.parse(data);
  } catch {
    throw new Error("Share link contains invalid workspace data.");
  }
  if (
    !Array.isArray(payload) ||
    payload.length !== 4 ||
    payload[0] !== VERSION ||
    !Array.isArray(payload[1]) ||
    payload[1].length < 1 ||
    payload[1].length > 16
  )
    throw new Error("Share link uses an unsupported workspace format.");
  const panes = payload[1].map((entry, index) => {
    if (!Array.isArray(entry) || ![0, 1].includes(entry[0]))
      throw new Error("Share link contains an invalid pane.");
    if (entry[0] === 0) {
      if (
        ![0, 1].includes(entry[1]) ||
        typeof entry[2] !== "string" ||
        entry[2].length > 1_000_000 ||
        !validTitle(entry[3])
      )
        throw new Error("Share link contains an invalid input pane.");
      return {
        type: "input",
        kind: entry[1] ? "json" : "text",
        value: entry[2],
        title: entry[3] || null,
      };
    }
    if (
      !Number.isInteger(entry[1]) ||
      entry[1] < 0 ||
      entry[1] >= index ||
      payload[1][entry[1]]?.[0] !== 0 ||
      !validTitle(entry[2])
    )
      throw new Error("Share link contains an invalid output reference.");
    const options = entry[3] || [];
    if (
      !Array.isArray(options) ||
      options.length > 5 ||
      (options[0] != null && options[0] !== 0) ||
      (options[1] != null && !STYLES.has(options[1])) ||
      (options[2] != null &&
        (!Number.isInteger(options[2]) ||
          options[2] < 30 ||
          options[2] > 200)) ||
      (options[3] != null &&
        (!Number.isInteger(options[3]) || options[3] < 1 || options[3] > 8)) ||
      (options[4] != null &&
        (typeof options[4] !== "string" || options[4].length > 20_000))
    )
      throw new Error("Share link contains invalid formatter settings.");
    return {
      type: "output",
      inputIndex: entry[1],
      title: entry[2] || null,
      format: options[0] !== 0,
      style: options[1] || "LLVM",
      columnLimit: options[2] || 80,
      indentWidth: options[3] || 2,
      customConfig: options[4] || "",
    };
  });
  if (!panes.some((pane) => pane.type === "input"))
    throw new Error("Share link has no input pane.");
  const outputs = new Set();
  for (const pane of panes)
    if (pane.type === "output") {
      if (outputs.has(pane.inputIndex))
        throw new Error("Share link has duplicate outputs.");
      outputs.add(pane.inputIndex);
    }
  const seen = new Set();
  validateTree(payload[2], panes.length, seen);
  if (
    seen.size !== panes.length ||
    !Number.isInteger(payload[3]) ||
    payload[3] < 0 ||
    payload[3] >= panes.length
  )
    throw new Error("Share link has an invalid pane layout.");
  return { panes, tree: payload[2], active: payload[3] };
}
