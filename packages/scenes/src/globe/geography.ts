import { normalizeLongitude } from '@pxoracle/contracts/globe-geography';
export type CountryPolygons = Record<string, number[][][][]>;
/** Polygon membership only; this never turns a surface click into a birthplace. */
export function ringContains(ring:number[][], latitude:number, longitude:number) {
  if (ring.length < 3) return false;
  // Unwrap the entire ring, then place the query in that same longitude interval.
  const points:number[][]=[]; let last=ring[0][0];
  for(const [lon,lat] of ring){last+=normalizeLongitude(lon-last);points.push([last,lat]);}
  const mean=points.reduce((s,p)=>s+p[0],0)/points.length;
  const x=mean+normalizeLongitude(longitude-mean);let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const [xi,yi]=points[i],[xj,yj]=points[j];
    if((yi>latitude)!==(yj>latitude)&&x<(xj-xi)*(latitude-yi)/(yj-yi)+xi)inside=!inside;
  }
  return inside;
}
export function countryAt(polygons:CountryPolygons,latitude:number,longitude:number):string|null{
  for(const [code,multi] of Object.entries(polygons))for(const rings of multi){
    if(ringContains(rings[0],latitude,longitude)&&!rings.slice(1).some(r=>ringContains(r,latitude,longitude)))return code;
  }
  return null;
}
export const ELEVATION_WIDTH=1081,ELEVATION_HEIGHT=541;
export function sampleElevation(field:Int16Array,latitude:number,longitude:number,width=ELEVATION_WIDTH,height=ELEVATION_HEIGHT):number{
  const x=(normalizeLongitude(longitude)+180)/360*(width-1);
  const y=(90-Math.max(-90,Math.min(90,latitude)))/180*(height-1);
  const x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;
  const at=(xx:number,yy:number)=>field[Math.min(height-1,yy)*width+Math.min(width-1,xx)];
  return (at(x0,y0)*(1-fx)+at(x0+1,y0)*fx)*(1-fy)+(at(x0,y0+1)*(1-fx)+at(x0+1,y0+1)*fx)*fy;
}
