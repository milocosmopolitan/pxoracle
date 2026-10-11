import { useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Chart } from "@pxoracle/contracts";
import type { InterpretationPlan, NatalInput } from "@pxoracle/contracts/natal";
import { StateProvider, useOracle, useOracleStore } from "../state/store";
import { SceneCanvas } from "../runtime/SceneCanvas";
import Astrology from "../features/Astrology";
import fixtures from "../../../../tests/fixtures/natal.json";

const meta = { title: "PXOracle/Birthplace journey", parameters: { layout: "fullscreen" }, decorators: [(Story: React.ComponentType) => <StateProvider><Story /></StateProvider>] } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const f = fixtures.find(f => f.name === "exact")!;
const engine = {
  calculateNatal: async () => ({chart:f.chart as Chart, facts:f.facts as NatalInput}),
  restoreNatal: async () => ({chart:f.chart as Chart, facts:f.facts as NatalInput}),
  interpretNatal: async () => f.plan as InterpretationPlan,
};
function Journey({ country, frozen = false, midpoint = false }: {country?:string;frozen?:boolean;midpoint?:boolean}) {
  const store = useOracleStore();
  const astrology = useOracle(s => s.astrologyView);
  const globe = useOracle(s => s.globeView);
  useEffect(() => { store.getState().navigateBirthplace(country ? {type:"country",country} : {type:"open"}); }, [store,country]);
  return <>
    <SceneCanvas route="astrology" frozen={frozen} data={{astrology, globe:globe ? {...globe,...(midpoint ? {reviewProgress:.5} : {})} : undefined}} />
    <Astrology engine={engine}/>
    <p style={{position:"fixed",bottom:0,left:12,zIndex:30,fontSize:11}}>STORYBOOK · Production birthplace journey · Synthetic chart transport · No WASM</p>
  </>;
}
export const RegionToCity: Story = {render:()=><Journey/>};
export const Russia: Story = {render:()=><Journey country="RU" frozen/>};
export const Singapore: Story = {render:()=><Journey country="SG" frozen/>};
export const Fiji: Story = {render:()=><Journey country="FJ" frozen/>};
export const ReducedMotion: Story = {render:()=><Journey frozen/>};
export const Mobile: Story = {render:()=><Journey country="FJ" frozen/>,globals:{viewport:{value:"mobile390",isRotated:false}}};
