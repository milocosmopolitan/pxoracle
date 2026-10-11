import { test } from "node:test";
import assert from "node:assert/strict";
import controllerModule from "../apps/web/src/features/tarot/controller.ts";
const { TarotController, tarotView } = controllerModule;
import fixture from "./fixtures/engines.json" with { type: "json" };
function harness(engine) {
  const state = {
    tarot: null,
    tarotPresentation: {
      phase: "conversation",
      revision: 0,
      page: 0,
      focus: null,
      index: 0,
      attempt: 0,
      busy: false,
      error: "",
    },
  };
  const controller = new TarotController(
    {
      get: () => state,
      session: (s) => {
        state.tarot = s;
      },
      presentation: (p) => Object.assign(state.tarotPresentation, p),
    },
    async () => engine,
  );
  const event = (type) =>
    controller.event({ type, revision: state.tarotPresentation.revision });
  return { state, controller, event };
}
const initial = () => ({
  ...structuredClone(fixture.session),
  selections: [],
  spread: 1,
  state: "selecting",
});
const engine = {
  create: async () => initial(),
  restore: async (s) => structuredClone(s),
  select: async (s, slot) => ({
    ...s,
    selections: [
      {
        slot,
        positionId: "focus",
        card: s.deck[slot],
        revealed: false,
        meaningRefs: [],
      },
    ],
  }),
  reveal: async (s) => ({
    ...s,
    state: "reading",
    selections: s.selections.map((x) => ({ ...x, revealed: true })),
  }),
};
async function start(h) {
  await h.controller.start(1, false);
  h.event("done");
  h.event("done");
  h.event("done");
}
test("engine confirmation precedes dealing; no reshuffle after selection; reveal follows preparation", async () => {
  const h = harness(engine);
  await start(h);
  assert.equal(h.state.tarotPresentation.phase, "selecting");
  await h.controller.select(4);
  assert.equal(h.state.tarot.selections[0].slot, 4);
  assert.equal(h.state.tarotPresentation.phase, "dealing");
  const fixed = h.state.tarot;
  await h.controller.start(1, true);
  assert.equal(h.state.tarot, fixed);
  h.event("done");
  h.event("asset-error");
  assert.equal(h.state.tarot.selections[0].revealed, false);
  h.controller.retryArt();
  assert.equal(h.state.tarot.selections[0].slot, 4);
  await h.event("ready");
  assert.equal(h.state.tarotPresentation.phase, "revealing");
  h.event("done");
  assert.equal(h.state.tarotPresentation.phase, "reading");
});
test("duplicate commands and obsolete scene acknowledgements cannot advance a draw", async () => {
  let resolve,
    calls = 0;
  const h = harness({
    ...engine,
    create: () => {
      calls++;
      return new Promise((r) => (resolve = r));
    },
  });
  const pending = h.controller.start(1, false);
  await Promise.resolve();
  await h.controller.start(1, false);
  assert.equal(calls, 1);
  resolve(initial());
  await pending;
  const old = h.state.tarotPresentation.revision;
  h.event("done");
  h.controller.event({ type: "done", revision: old });
  assert.equal(h.state.tarotPresentation.phase, "shuffle");
});
test("navigation abandonment ignores late engine responses", async () => {
  let resolve;
  const h = harness({
    ...engine,
    create: () => new Promise((r) => (resolve = r)),
  });
  const pending = h.controller.start(1, false);
  await Promise.resolve();
  h.controller.dispose();
  resolve(initial());
  await pending;
  assert.equal(h.state.tarot, null);
});
test("restoration settles without replay and scene projection excludes hidden deck and question", async () => {
  const h = harness(engine);
  const s = initial();
  s.selections = [
    {
      slot: 7,
      positionId: "focus",
      card: s.deck[7],
      revealed: true,
      meaningRefs: [],
    },
  ];
  s.state = "reading";
  await h.controller.restore(s);
  assert.equal(h.state.tarotPresentation.phase, "reading");
  const view = tarotView(h.state.tarot, h.state.tarotPresentation, null);
  assert.equal(view.cards.length, 1);
  assert.equal("deck" in view, false);
  assert.equal("cardId" in view.cards[0], false);
  assert.equal("question" in view, false);
});
