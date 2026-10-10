// Compile-time checks of real native/WASM fixture field names, alongside JSON Schema tests.
import fixture from '../../../tests/fixtures/engines.json';
import type {Chart,TarotSession,Card,BirthInput} from './index';
export const chartFixture = {...fixture.chart,schemaVersion:1 as const} satisfies Chart;
export const inputFixture = {...fixture.birth,accuracy:'exact' as const} satisfies BirthInput;
function orientation(value:string):Card['orientation']{if(value==='upright'||value==='reversed')return value;throw new Error('Invalid fixture orientation');}
export const tarotFixture = {...fixture.session,schemaVersion:1 as const,spread:3 as const,state:'selecting' as const,deck:fixture.session.deck.map(card=>({...card,orientation:orientation(card.orientation)}))} satisfies TarotSession;
