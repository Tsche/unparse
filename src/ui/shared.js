export const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
export const icons = {
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4Z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5a8.5 8.5 0 1 0 11.7 11.7Z"/></svg>',
};

export function syntax(source, kind, unknown = false) {
  if (kind === "json") {
    const pattern =
      /("(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\b(?:true|false|null)\b|[{}\[\],:])/g;
    let html = "";
    let end = 0;
    for (const match of source.matchAll(pattern)) {
      html += escapeHtml(source.slice(end, match.index));
      const token = match[0];
      let cls = "token-punctuation";
      if (token.startsWith('"'))
        cls = source
          .slice(match.index + token.length)
          .trimStart()
          .startsWith(":")
          ? "token-type"
          : "token-string";
      else if (/^-?\d/.test(token)) cls = "token-number";
      else if (/^[a-z]/.test(token)) cls = "token-keyword";
      html += `<span class="${cls}">${escapeHtml(token)}</span>`;
      end = match.index + token.length;
    }
    return html + escapeHtml(source.slice(end));
  }
  const pattern =
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\*[\s\S]*?\*\/|\/\/.*|0x[\da-fA-F]+|\b(?:true|false|nullptr|void|bool|char|int|long|unsigned|const|static_cast|reinterpret_cast|dynamic_cast|const_cast)\b|\b[A-Za-z_]\w*\b)/g;
  let html = "",
    end = 0;
  for (const match of source.matchAll(pattern)) {
    html += escapeHtml(source.slice(end, match.index));
    const token = match[0];
    let cls = "token-name";
    if (token.startsWith("/*")) cls = "token-error";
    else if (token.startsWith("//"))
      cls = kind === "error" ? "token-error" : "token-comment";
    else if (
      unknown &&
      kind === "ast" &&
      match.index === source.search(/[A-Za-z_]/)
    )
      cls = "token-error";
    else if (kind === "ast" && token.startsWith("'")) {
      const fragment = token.slice(1, -1);
      const isCppFragment =
        /\b(?:void|bool|char|short|int|long|unsigned|const|volatile|class|struct)\b|[()*\[\]{}:]|\b[A-Za-z_]\w*\s*\(/.test(
          fragment,
        );
      if (isCppFragment) {
        html += `<span class="token-punctuation">&#39;</span>${syntax(fragment, "cpp")}<span class="token-punctuation">&#39;</span>`;
        end = match.index + token.length;
        continue;
      }
      cls = "token-string";
    } else if (token.startsWith('"') || token.startsWith("'"))
      cls = "token-string";
    else if (token.startsWith("0x") || /^\d/.test(token)) cls = "token-number";
    else if (
      /^(true|false|nullptr|void|bool|char|int|long|unsigned|const|static_cast|reinterpret_cast|dynamic_cast|const_cast)$/.test(
        token,
      )
    )
      cls = "token-keyword";
    else if (
      kind === "ast" &&
      /(Expr|Operator|Literal|Cast|Decl|Loc|Stmt|Type)$/.test(token)
    )
      cls = "token-type";
    html += `<span class="${cls}">${escapeHtml(token)}</span>`;
    end = match.index + token.length;
  }
  return html + escapeHtml(source.slice(end));
}

export function mapSpans(raw, formatted, spans) {
  if (raw === formatted) return spans;
  const a = [...raw.matchAll(/\S/g)].map((m) => m.index),
    b = [...formatted.matchAll(/\S/g)].map((m) => m.index);
  if (
    a.length !== b.length ||
    a.some((index, i) => raw[index] !== formatted[b[i]])
  )
    return [];
  const lower = (value) => {
    let start = 0,
      end = a.length;
    while (start < end) {
      const mid = (start + end) >> 1;
      if (a[mid] < value) start = mid + 1;
      else end = mid;
    }
    return start;
  };
  return spans.map((span) => {
    const first = lower(span.start),
      last = lower(span.end) - 1;
    return {
      id: span.id,
      start: b[first] ?? formatted.length,
      end: last >= first ? b[last] + 1 : (b[first] ?? formatted.length),
    };
  });
}
export async function copyText(value) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    /* Browser permission is unavailable. */
  }
}
