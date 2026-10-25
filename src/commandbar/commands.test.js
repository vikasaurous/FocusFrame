/**
 * commands.test.js
 * Run:  node --test src/commandbar/commands.test.js
 */
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const C = require("./commands.js");

const all = () => C.getCommands(C.DEFAULT_SETTINGS);

test("every built-in has a safe https home URL and valid shape", () => {
  for (const cmd of C.BUILTINS) {
    assert.ok(C.isSafeUrl(cmd.homeUrl), `${cmd.id}: unsafe homeUrl`);
    assert.ok(cmd.aliases.length > 0, `${cmd.id}: no aliases`);
    if (cmd.supportsPrefill)
      assert.ok(C.validateTemplate(cmd.template), `${cmd.id}: bad template`);
    else
      assert.ok(
        !C.hasPlaceholder(cmd.template),
        `${cmd.id}: no-prefill command has placeholder`,
      );
  }
});

test("built-in aliases are unique", () => {
  const seen = new Set();
  for (const cmd of C.BUILTINS)
    for (const a of cmd.aliases) {
      assert.ok(!seen.has(a), `duplicate alias ${a}`);
      seen.add(a);
    }
});

test("buildUrl: prefill encodes query", () => {
  const claude = C.findById(all(), "claude");
  const r = C.buildUrl(claude, "hello world & more #1?");
  assert.equal(
    r.url,
    "https://claude.ai/new?q=hello%20world%20%26%20more%20%231%3F",
  );
  assert.equal(r.copyText, null);
});

test("buildUrl: unicode and newlines are encoded", () => {
  const gpt = C.findById(all(), "chatgpt");
  const r = C.buildUrl(gpt, "नमस्ते\nline2");
  assert.ok(r.url.startsWith("https://chatgpt.com/?q="));
  assert.ok(!/[\n ]/.test(r.url));
  assert.equal(decodeURIComponent(r.url.split("?q=")[1]), "नमस्ते\nline2");
});

test('buildUrl: "$&" style text is not treated as a replace pattern', () => {
  const gpt = C.findById(all(), "chatgpt");
  const r = C.buildUrl(gpt, "$& $1 $' $`");
  assert.equal(decodeURIComponent(r.url.split("?q=")[1]), "$& $1 $' $`");
});

test("buildUrl: empty query opens home page, no copy", () => {
  const claude = C.findById(all(), "claude");
  const r = C.buildUrl(claude, "   ");
  assert.equal(r.url, claude.homeUrl);
  assert.equal(r.copyText, null);
});

test("buildUrl: no-prefill provider (Gemini) -> home + clipboard text", () => {
  const gem = C.findById(all(), "gemini");
  const r = C.buildUrl(gem, "plan my day");
  assert.equal(r.url, gem.homeUrl);
  assert.equal(r.copyText, "plan my day");
  assert.equal(r.reason, "no-prefill");
});

test("buildUrl: too-long query -> home + clipboard text", () => {
  const claude = C.findById(all(), "claude");
  const long = "a".repeat(3000);
  const r = C.buildUrl(claude, long);
  assert.equal(r.url, claude.homeUrl);
  assert.equal(r.copyText, long);
  assert.equal(r.reason, "too-long");
});

test("isSafeUrl: blocks http, javascript:, data:, credentials, garbage", () => {
  assert.ok(C.isSafeUrl("https://example.com/a?b=c"));
  assert.ok(!C.isSafeUrl("http://example.com"));
  assert.ok(!C.isSafeUrl("javascript:alert(1)"));
  assert.ok(!C.isSafeUrl("data:text/html,hi"));
  assert.ok(!C.isSafeUrl("https://user:pw@example.com"));
  assert.ok(!C.isSafeUrl("https://trusted.com@evil.com/"));
  assert.ok(!C.isSafeUrl("not a url"));
  assert.ok(!C.isSafeUrl(""));
});

test("validateTemplate: needs exactly one {query}, https, no credentials", () => {
  assert.ok(C.validateTemplate("https://kagi.com/search?q={query}"));
  assert.ok(!C.validateTemplate("https://kagi.com/search"));
  assert.ok(!C.validateTemplate("https://kagi.com/?a={query}&b={query}"));
  assert.ok(!C.validateTemplate("http://kagi.com/?q={query}"));
  assert.ok(!C.validateTemplate("https://a@b.com/?q={query}"));
  assert.ok(!C.validateTemplate("javascript:{query}"));
  assert.ok(!C.validateTemplate(null));
});

test("getCommands: disabled built-ins are removed", () => {
  const list = C.getCommands({
    ...C.DEFAULT_SETTINGS,
    disabledIds: ["grok", "ddg"],
  });
  assert.ok(!C.findById(list, "grok"));
  assert.ok(!C.findById(list, "ddg"));
  assert.ok(C.findById(list, "claude"));
});

test("getCommands: custom commands validated; bad ones dropped", () => {
  const list = C.getCommands({
    ...C.DEFAULT_SETTINGS,
    customCommands: [
      {
        id: "kagi",
        label: "Kagi",
        aliases: ["kagi", "K!"],
        template: "https://kagi.com/search?q={query}",
      },
      {
        id: "bad1",
        label: "Bad",
        aliases: ["bad"],
        template: "http://x.com/?q={query}",
      },
      {
        id: "bad2",
        label: "Bad2",
        aliases: ["bad2"],
        template: "https://x.com/",
      },
    ],
  });
  const kagi = C.findById(list, "kagi");
  assert.ok(kagi);
  assert.deepEqual(kagi.aliases, ["kagi", "k"]);
  assert.equal(kagi.homeUrl, "https://kagi.com/");
  assert.ok(!C.findById(list, "bad1"));
  assert.ok(!C.findById(list, "bad2"));
});

test("getCommands: alias collisions resolved, first wins", () => {
  const list = C.getCommands({
    ...C.DEFAULT_SETTINGS,
    customCommands: [
      {
        id: "mine",
        label: "Mine",
        aliases: ["claude", "mine"],
        template: "https://m.com/?q={query}",
      },
    ],
  });
  assert.equal(C.findByAlias(list, "claude").id, "claude");
  assert.equal(C.findByAlias(list, "mine").id, "mine");
});

test("findByAlias: case-insensitive, unknown -> null", () => {
  assert.equal(C.findByAlias(all(), "CLAUDE").id, "claude");
  assert.equal(C.findByAlias(all(), "nope"), null);
  assert.equal(C.findByAlias(all(), ""), null);
});

test("filterCommands: prefix first, then substring, empty = all", () => {
  const list = all();
  assert.equal(C.filterCommands(list, "").length, list.length);
  const r = C.filterCommands(list, "g");
  assert.ok(r.length >= 3);
  assert.ok(
    r[0].aliases
      .concat([r[0].label.toLowerCase()])
      .some((x) => x.startsWith("g")),
  );
  assert.equal(C.filterCommands(list, "zzzz").length, 0);
  assert.equal(C.filterCommands(list, "cla")[0].id, "claude");
});

test("parseLeadingCommand", () => {
  const list = all();
  const p = C.parseLeadingCommand("/claude hello there", list);
  assert.equal(p.command.id, "claude");
  assert.equal(p.rest, "hello there");
  assert.equal(C.parseLeadingCommand("/claude", list), null); // no space yet
  assert.equal(C.parseLeadingCommand("/nope hi", list), null);
  assert.equal(C.parseLeadingCommand("hello /claude hi", list), null);
  assert.equal(
    C.parseLeadingCommand("/gpt multi\nline", list).rest,
    "multi\nline",
  );
});

test("mergeSettings: fixes bad values, keeps good ones", () => {
  const s = C.mergeSettings({
    enabled: false,
    openIn: "weird",
    defaultCommandId: 5,
    disabledIds: "x",
  });
  assert.equal(s.enabled, false);
  assert.equal(s.openIn, "same");
  assert.equal(s.defaultCommandId, "chatgpt");
  assert.deepEqual(s.disabledIds, []);
  assert.equal(C.mergeSettings(null).enabled, true);
  assert.equal(C.mergeSettings({ openIn: "new" }).openIn, "new");
});

test("domainOf strips www", () => {
  assert.equal(C.domainOf(C.findById(all(), "perplexity")), "perplexity.ai");
  assert.equal(C.domainOf(C.findById(all(), "claude")), "claude.ai");
});

test("default shortcut is Alt + K and passes validation", () => {
  assert.deepEqual(C.DEFAULT_SETTINGS.shortcut, {
    mod: false,
    alt: true,
    shift: false,
    code: "KeyK",
  });
  assert.ok(C.validateShortcut(C.DEFAULT_SETTINGS.shortcut).ok);
});

test("validateShortcut: allowed combos", () => {
  assert.ok(C.validateShortcut({ mod: true, code: "Slash" }).ok);
  assert.ok(C.validateShortcut({ mod: true, code: "Period" }).ok);
  assert.ok(C.validateShortcut({ alt: true, code: "KeyK" }).ok);
  assert.ok(C.validateShortcut({ alt: true, code: "KeyJ" }).ok);
});

test("validateShortcut: rejects browser/OS-bound or risky combos", () => {
  const bad = [
    { mod: true, code: "KeyK" }, // Chrome: search bar
    { mod: true, code: "KeyT" }, // new tab
    { mod: true, code: "Digit1" }, // switch tab
    { mod: true, shift: true, code: "KeyT" }, // reopen tab
    { alt: true, code: "KeyF" }, // Chrome menu
    { alt: true, code: "KeyE" },
    { alt: true, code: "KeyD" }, // address bar
    { alt: true, code: "F4" },
    { alt: true, code: "Space" },
    { alt: true, code: "ArrowLeft" }, // back
    { alt: true, shift: true, code: "KeyT" },
    { mod: true, alt: true, code: "Slash" }, // AltGr risk
    { code: "Backquote" }, // no modifier
    { shift: true, code: "KeyA" },
    { mod: true, code: "" },
    null,
  ];
  for (const sc of bad) {
    const r = C.validateShortcut(sc);
    assert.ok(!r.ok, `should reject ${JSON.stringify(sc)}`);
    assert.ok(typeof r.reason === "string" && r.reason.length > 0);
  }
});

test("matchShortcut: Ctrl or Cmd, exact modifiers, physical key", () => {
  const sc = { mod: true, alt: false, shift: false, code: "Slash" };
  assert.ok(C.matchShortcut({ code: "Slash", ctrlKey: true }, sc));
  assert.ok(C.matchShortcut({ code: "Slash", metaKey: true }, sc));
  assert.ok(!C.matchShortcut({ code: "Slash" }, sc));
  assert.ok(
    !C.matchShortcut({ code: "Slash", ctrlKey: true, shiftKey: true }, sc),
  );
  assert.ok(
    !C.matchShortcut({ code: "Slash", ctrlKey: true, altKey: true }, sc),
  );
  assert.ok(!C.matchShortcut({ code: "KeyK", ctrlKey: true }, sc));
  assert.ok(!C.matchShortcut({ code: "Slash", ctrlKey: true }, null));
});

test("shortcutFromEvent + formatShortcut", () => {
  const sc = C.shortcutFromEvent({ code: "KeyJ", altKey: true });
  assert.deepEqual(sc, { mod: false, alt: true, shift: false, code: "KeyJ" });
  assert.equal(C.formatShortcut(sc, false), "Alt + J");
  assert.equal(C.formatShortcut(C.DEFAULT_SETTINGS.shortcut, false), "Alt + K");
  assert.equal(C.formatShortcut(C.DEFAULT_SETTINGS.shortcut, true), "⌥ K");
});

test("mergeSettings: invalid saved shortcut falls back to default; valid one kept", () => {
  assert.deepEqual(
    C.mergeSettings({ shortcut: { mod: true, code: "KeyK" } }).shortcut,
    C.DEFAULT_SETTINGS.shortcut,
  );
  assert.deepEqual(
    C.mergeSettings({ shortcut: "junk" }).shortcut,
    C.DEFAULT_SETTINGS.shortcut,
  );
  assert.deepEqual(
    C.mergeSettings({ shortcut: { alt: true, code: "KeyJ" } }).shortcut,
    { mod: false, alt: true, shift: false, code: "KeyJ" },
  );
  assert.deepEqual(C.mergeSettings(null).shortcut, C.DEFAULT_SETTINGS.shortcut);
});

test("mergeSettings: old saved default (Ctrl + /) migrates to the new default", () => {
  assert.deepEqual(
    C.mergeSettings({
      shortcut: { mod: true, alt: false, shift: false, code: "Slash" },
    }).shortcut,
    C.DEFAULT_SETTINGS.shortcut,
  );
  // other valid choices are still kept
  assert.deepEqual(
    C.mergeSettings({ shortcut: { mod: true, code: "Period" } }).shortcut,
    { mod: true, alt: false, shift: false, code: "Period" },
  );
});
