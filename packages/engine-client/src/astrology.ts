import { EngineClient } from "./client";
import type { BirthInput, Chart } from "@pxoracle/contracts";
const client = new EngineClient("astrology");
export const calculate = (input: BirthInput) => client.request<Chart>(input);
export const evict = () => client.dispose();
