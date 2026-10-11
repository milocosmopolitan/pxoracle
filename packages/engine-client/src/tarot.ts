import { EngineClient } from "./client";
import type { TarotSession } from "@pxoracle/contracts";
const client = new EngineClient("tarot");
export function create(spread: 1 | 3, reversals = false) {
  const seed = Array.from(crypto.getRandomValues(new Uint32Array(2)));
  return client.request<TarotSession>({
    op: "create",
    seed,
    spread,
    reversalPercent: reversals ? 50 : 0,
  });
}
export const select = (session: TarotSession, slot: number) =>
  client.request<TarotSession>({ op: "select", session, slot });
export const reveal = (session: TarotSession, index: number) =>
  client.request<TarotSession>({ op: "reveal", session, index });
export const restore = (session: unknown) =>
  client.request<TarotSession>({ op: "restore", session });
export const complete = (session: TarotSession) =>
  client.request<TarotSession>({ op: "complete", session });
export const evict = () => client.dispose();

import type { ReadingInput, ReadingPlan } from "@pxoracle/contracts/reading";
export const interpret = (input: ReadingInput) =>
  client.request<ReadingPlan>({ op: "readingInterpret", input });
