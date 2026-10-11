import { EngineClient } from "./client";
import type { BirthInput, Chart } from "@pxoracle/contracts";
const client = new EngineClient("astrology");
export const calculate = (input: BirthInput) => client.request<Chart>(input);
export const evict = () => client.dispose();

import type { NatalInput, InterpretationPlan } from "@pxoracle/contracts/natal";
export type NatalCalculation = { chart: Chart; facts: NatalInput };
export const calculateNatal = (input: BirthInput) => client.request<NatalCalculation>({ op: "calculateNatal", input });
export const restoreNatal = (chart: unknown) => client.request<NatalCalculation>({ op: "restoreNatal", chart });
export const interpretNatal = (input: NatalInput) => client.request<InterpretationPlan>({ op: "natalInterpret", input });
