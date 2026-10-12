import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import decks from "../apps/web/src/features/tarot/deck.ts";

const { resolveCardLook, resolveEffect } = decks;

const pub = new URL("../apps/web/public", import.meta.url);
const read = (url) => JSON.parse(readFileSync(new URL("." + url, pub + "/")));
const index = read("/art/decks/index.json");
const parts = read(index.parts);

test("every published deck resolves all 78 cards to existing layer files", () => {
  assert.deepEqual(
    index.decks.map((d) => d.id),
    ["pxoracle", "rider-waite-smith"],
  );
  for (const entry of index.decks) {
    const deck = read(entry.url);
    assert.equal(Object.keys(deck.cards).length, 78, entry.id);
    for (const cardId of Object.keys(deck.cards)) {
      const look = resolveCardLook({ deck, parts }, cardId);
      for (const url of [look.art, look.frame, look.effect.billboard, ...look.banners.map((b) => b.url)])
        if (url) assert.ok(existsSync(new URL("." + url, pub + "/")), url);
    }
  }
});

test("house deck shows only the bottom parchment name banner and the gilded effect", () => {
  const deck = read("/art/decks/pxoracle/deck.json");
  const look = resolveCardLook({ deck, parts }, "major.17");
  assert.deepEqual(look.banners.map((b) => [b.slot, b.text]), [["bottom", "The Star"]]);
  assert.equal(look.effect.id, "gilded");
  assert.ok(look.frame);
  // Rider–Waite–Smith scans carry their own border and titles.
  const rws = resolveCardLook({ deck: read("/art/decks/rider-waite-smith/deck.json"), parts }, "major.17");
  assert.equal(rws.frame, undefined);
  assert.deepEqual(rws.banners, []);
  assert.equal(rws.fit, "contain");
  assert.equal(rws.effect.id, "amethyst");
});

test("a single card can override frame, each banner slot and effect independently", () => {
  const base = read("/art/decks/pxoracle/deck.json");
  const deck = {
    ...base,
    cards: {
      ...base.cards,
      "major.00": {
        ...base.cards["major.00"],
        frame: "none",
        effect: "amethyst",
        banners: { top: { style: "clear", text: "numeral" } },
      },
    },
  };
  const look = resolveCardLook({ deck, parts }, "major.00");
  assert.equal(look.frame, undefined);
  assert.equal(look.effect.id, "amethyst");
  // The top override is added; the bottom slot still inherits the deck default.
  assert.deepEqual(
    look.banners.map((b) => [b.slot, b.text, b.url]),
    [
      ["top", "0", parts.banners.clear.url],
      ["bottom", "The Fool", parts.banners.parchment.url],
    ],
  );
  // The top slot mirrors the banner, so its text box sits in the plate, away from the rule line.
  const [top] = look.banners;
  assert.ok(top.textBox[1] < top.rect[1] + top.rect[3] / 2);
  // Neighbouring cards keep the deck defaults.
  const other = resolveCardLook({ deck, parts }, "major.01");
  assert.equal(other.effect.id, "gilded");
  assert.deepEqual(other.banners.map((b) => b.slot), ["bottom"]);
  // An explicit null removes an inherited slot.
  deck.cards["major.02"] = { ...base.cards["major.02"], banners: { bottom: null } };
  assert.deepEqual(resolveCardLook({ deck, parts }, "major.02").banners, []);
});

test("unknown parts fail loudly instead of rendering a half-built card", () => {
  const deck = read("/art/decks/pxoracle/deck.json");
  deck.cards["major.03"] = { ...deck.cards["major.03"], effect: "missing" };
  assert.throws(() => resolveCardLook({ deck, parts }, "major.03"), /Unknown card effect/);
  assert.throws(() => resolveEffect(parts, "nope"), /Unknown card effect/);
});
