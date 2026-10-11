import type { Meta, StoryObj } from '@storybook/react-vite';
import {useEffect,useRef,useState} from 'react';
import {SceneRuntime} from '@pxoracle/scene-runtime';
import {globePreview} from '@pxoracle/scenes/globe/preview';
function GlobeStory({angle='front',quality='country'}:{angle:'front'|'side'|'rear'|'terrain';quality:'room'|'country'}){
 const canvas=useRef<HTMLCanvasElement>(null),runtime=useRef<SceneRuntime|null>(null);const [status,setStatus]=useState('');
 useEffect(()=>{if(!canvas.current)return;try{runtime.current=new SceneRuntime(canvas.current,setStatus);}catch{setStatus('WebGL unavailable');}return()=>{runtime.current?.dispose();runtime.current=null;};},[]);
 useEffect(()=>{const owned=runtime.current;if(owned)void owned.navigate(globePreview(angle,quality));return()=>owned?.cancelPreparation();},[angle,quality]);
 return <div style={{height:'100vh',background:'#202a29',color:'#e4c998'}}><canvas ref={canvas} style={{display:'block',width:'100%',height:'calc(100% - 40px)'}} aria-label="Original antique globe production assembly"/><p style={{margin:0,padding:8}}>Original production globe · {angle} · {quality} · {status||'Ready'}</p></div>;
}
const meta={title:'Room/Production Globe',component:GlobeStory,parameters:{layout:'fullscreen'},args:{angle:'front',quality:'country'},argTypes:{angle:{control:'select',options:['front','side','rear','terrain']}}} satisfies Meta<typeof GlobeStory>;
export default meta;type Story=StoryObj<typeof meta>;
export const Front:Story={};export const Side:Story={args:{angle:'side'}};export const Rear:Story={args:{angle:'rear'}};export const Terrain:Story={args:{angle:'terrain'}};

export const RoomQuality:Story={args:{quality:'room'}};
