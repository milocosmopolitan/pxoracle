import test from 'node:test';
import assert from 'node:assert/strict';
import consultation from '../apps/web/src/state/consultation.ts';
import storeModule from '../apps/web/src/state/store.tsx';
import savedProbe from '../apps/web/src/features/astrology/savedProbe.ts';
const { emptyConsultation, navigateConsultation, birthInputFrom, consultationFromInput } = consultation;
const { createAppStore } = storeModule;
const { probeSaved } = savedProbe;
import { readFile } from 'node:fs/promises';

const seoul = { label: 'Seoul, Seoul, South Korea', timezone: 'Asia/Seoul', latitude: 37.566, longitude: 126.9784, provenance: { source: 'atlas', label: 'Seoul, Seoul, South Korea', cityId: '1835848', country: 'KR', atlasVersion: 'fixture' } };
const go = (state, ...intents) => intents.reduce(navigateConsultation, state);

test('entry begins at the table hub; chart presence never selects the crystal', () => {
  const initial = emptyConsultation();
  assert.equal(initial.stage, 'hub');
  assert.equal(initial.presentation, 'consultation');
  assert.equal(navigateConsultation(initial, { type: 'arrive' }), initial, 'arrival at the hub is a no-op');
  const crystal = go(initial, { type: 'service', service: 'natal' }, { type: 'open-crystal' });
  assert.equal(crystal.presentation, 'crystal');
  const back = navigateConsultation(crystal, { type: 'arrive' });
  assert.equal(back.presentation, 'consultation');
  assert.equal(back.stage, 'hub');
});

test('services branch: horoscopes never enters the globe; natal greets first', () => {
  const horoscopes = go(emptyConsultation(), { type: 'service', service: 'horoscopes' });
  assert.equal(horoscopes.stage, 'horoscopes');
  assert.equal(horoscopes.presentation, 'consultation');
  const natal = go(emptyConsultation(), { type: 'service', service: 'natal' });
  assert.equal(natal.stage, 'greeting');
  assert.equal(natal.presentation, 'consultation', 'choosing Natal Chart does not open the globe');
  assert.equal(go(natal, { type: 'hub' }).service, null);
});

test('new chart explores the globe; confirmation returns to the table with the place and draft retained', () => {
  let state = go(emptyConsultation(), { type: 'service', service: 'natal' }, { type: 'draft', draft: { date: '2000-01-01', time: '12:00' } }, { type: 'new-chart' });
  assert.equal(state.stage, 'birthplace');
  assert.equal(state.presentation, 'globe');
  assert.equal(state.draft, null, 'a new chart clears the previous draft');
  state = go(state, { type: 'draft', draft: { date: '2000-01-01', time: '12:00' } });
  const confirmed = go(state, { type: 'confirm-birthplace', birthplace: seoul });
  assert.equal(confirmed.presentation, 'consultation');
  assert.equal(confirmed.stage, 'details');
  assert.deepEqual(confirmed.birthplace, seoul);
  assert.equal(confirmed.draft.date, '2000-01-01', 'already entered date and time survive confirmation');
  // Reopening the globe to change the place and cancelling keeps the prior confirmed place.
  const reopened = go(confirmed, { type: 'explore-birthplace' });
  assert.equal(reopened.presentation, 'globe');
  const cancelled = go(reopened, { type: 'cancel-birthplace' });
  assert.deepEqual(cancelled.birthplace, seoul);
  assert.equal(cancelled.stage, 'details');
  assert.equal(cancelled.presentation, 'consultation');
  // Cancelling without any confirmed place returns to the greeting.
  const fresh = go(emptyConsultation(), { type: 'new-chart' }, { type: 'cancel-birthplace' });
  assert.equal(fresh.stage, 'greeting');
});

test('review requires a confirmed place; saved details skip the globe; return keeps data', () => {
  const noPlace = go(emptyConsultation(), { type: 'service', service: 'natal' }, { type: 'review' });
  assert.equal(noPlace.stage, 'birthplace');
  const saved = go(emptyConsultation(), { type: 'service', service: 'natal' }, { type: 'use-saved', birthplace: seoul, draft: { date: '2000-01-01', time: '12:00', accuracy: 'exact', uncertaintyMinutes: 30 } });
  assert.equal(saved.stage, 'review');
  assert.equal(saved.presentation, 'consultation', 'saved details never visit the globe');
  const edited = go(saved, { type: 'use-saved', stage: 'details', birthplace: seoul, draft: saved.draft });
  assert.equal(edited.stage, 'details');
  const crystal = go(saved, { type: 'open-crystal' });
  const returned = go(crystal, { type: 'return' });
  assert.equal(returned.presentation, 'consultation');
  assert.equal(returned.stage, 'hub', 'leaving the crystal offers resume rather than re-calculation');
  assert.deepEqual(returned.birthplace, seoul);
  assert.deepEqual(returned.draft, saved.draft);
  assert.equal(go(returned, { type: 'return' }), returned, 'return at the table is a no-op');
});

test('revisions change only on navigation so late completions can be ignored', () => {
  const start = go(emptyConsultation(), { type: 'service', service: 'natal' });
  const typed = go(start, { type: 'draft', draft: { time: '08:00' } }, { type: 'saved', availability: 'none' });
  assert.equal(typed.revision, start.revision, 'typing and probing do not move the camera revision');
  const moved = go(typed, { type: 'return' }, { type: 'hub' });
  assert.ok(moved.revision > typed.revision);
  // A calculation started before a return must not reopen the crystal: callers compare revisions.
  const requested = go(typed, { type: 'review' });
  const left = go(requested, { type: 'hub' });
  assert.notEqual(left.revision, requested.revision);
});

test('birth input assembly mirrors the engine contract, including unknown and approximate times', () => {
  assert.equal(birthInputFrom(null, { date: '2000-01-01', time: '12:00', accuracy: 'exact', uncertaintyMinutes: 30 }), null);
  assert.equal(birthInputFrom(seoul, { date: '2000-01-01', time: '', accuracy: 'exact', uncertaintyMinutes: 30 }), null, 'exact time is required');
  const unknown = birthInputFrom(seoul, { date: '2000-01-01', time: '', accuracy: 'unknown', uncertaintyMinutes: 30 });
  assert.equal(unknown.time, null);
  assert.equal(unknown.uncertaintyMinutes, null);
  const approx = birthInputFrom(seoul, { date: '2000-01-01', time: '12:00', accuracy: 'approximate', uncertaintyMinutes: 45 }, 'later');
  assert.equal(approx.uncertaintyMinutes, 45);
  assert.equal(approx.fold, 'later');
  assert.equal(approx.timezone, 'Asia/Seoul');
  const round = consultationFromInput(approx, seoul.provenance);
  assert.deepEqual(round.birthplace, seoul);
  assert.equal(round.draft.time, '12:00');
  assert.equal(consultationFromInput(unknown, null).birthplace.provenance.source, 'manual');
});

test('store wiring: globe intents own the globe presentation and the landing shortcut keeps context', () => {
  const store = createAppStore();
  store.getState().navigateConsultation({ type: 'service', service: 'natal' });
  store.getState().navigateConsultation({ type: 'draft', draft: { date: '1999-12-31' } });
  store.getState().navigateBirthplace({ type: 'open' });
  assert.equal(store.getState().consultation.presentation, 'globe');
  assert.equal(store.getState().birthplace.phase, 'overview');
  store.getState().navigateBirthplace({ type: 'country', country: 'KR' });
  assert.equal(store.getState().consultation.presentation, 'globe');
  store.getState().navigateBirthplace({ type: 'back' });
  assert.equal(store.getState().consultation.presentation, 'globe', 'back one view stays in the globe until the room');
  store.getState().navigateBirthplace({ type: 'cancel' });
  assert.equal(store.getState().consultation.presentation, 'consultation');
  assert.equal(store.getState().birthplace.phase, 'room');
  assert.equal(store.getState().consultation.draft.date, '1999-12-31', 'cancelling the globe keeps the draft');
  // Landing globe shortcut: explicit globe entry with retained chart and consultation data.
  store.getState().setChart({ bodies: [], houses: null, aspects: [], provenance: { settings: {} } });
  store.getState().requestGlobeEntry();
  assert.equal(store.getState().globeEntryPending, true);
  assert.equal(store.getState().consultation.presentation, 'globe');
  assert.ok(store.getState().chart, 'the shortcut never discards the current chart');
  assert.equal(store.getState().consultation.draft.date, '1999-12-31');
});

test('saved-data probe distinguishes none, current, legacy, input-only, unsupported, corrupt and unavailable without writing', async () => {
  const fixtures = JSON.parse(await readFile(new URL('./fixtures/natal.json', import.meta.url)));
  const f = fixtures.find((x) => x.name === 'exact');
  const memory = (entries) => {
    const writes = [];
    const map = new Map(Object.entries(entries));
    return { storage: { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => writes.push([k, v]), removeItem: (k) => writes.push([k]) }, writes };
  };
  const none = memory({});
  assert.equal(probeSaved(() => none.storage).availability, 'none');
  const current = memory({ 'pxoracle.natal-report.v1': JSON.stringify({ schemaVersion: 1, input: f.input, chart: f.chart, plan: f.plan, versions: f.plan.versions, place: null, savedAt: '2026-10-11T00:00:00Z' }) });
  const probe = probeSaved(() => current.storage);
  assert.equal(probe.availability, 'current');
  assert.equal(probe.candidate.input.date, f.input.date);
  const unsupported = memory({ 'pxoracle.natal-report.v1': JSON.stringify({ schemaVersion: 1, input: f.input, chart: f.chart, plan: null, versions: { schema: 1 }, place: null, savedAt: 'x' }) });
  assert.equal(probeSaved(() => unsupported.storage).availability, 'unsupported');
  const legacy = memory({ 'pxoracle.astrology-chart.v1': JSON.stringify({ schemaVersion: 1, value: { input: f.input, chart: f.chart } }) });
  assert.equal(probeSaved(() => legacy.storage).availability, 'legacy');
  const inputOnly = memory({ 'pxoracle.astrology.v1': JSON.stringify({ schemaVersion: 1, value: f.input }) });
  assert.equal(probeSaved(() => inputOnly.storage).availability, 'input-only');
  const corrupt = memory({ 'pxoracle.natal-report.v1': '{not json' });
  assert.equal(probeSaved(() => corrupt.storage).availability, 'corrupt');
  const wrongVersion = memory({ 'pxoracle.natal-report.v1': JSON.stringify({ schemaVersion: 2 }) });
  assert.equal(probeSaved(() => wrongVersion.storage).availability, 'corrupt');
  assert.equal(probeSaved(() => { throw new Error('SecurityError'); }).availability, 'unavailable');
  assert.equal(probeSaved(() => ({ getItem() { throw new Error('denied'); } })).availability, 'unavailable');
  for (const m of [none, current, unsupported, legacy, inputOnly, corrupt, wrongVersion]) assert.deepEqual(m.writes, [], 'probing never writes');
});
