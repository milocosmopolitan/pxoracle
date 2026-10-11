#!/usr/bin/env python3
"""Offline globe cartography. Python 3 + Pillow 12.3; no remote dependencies."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, math, gzip, csv, io, hashlib, struct, random
ROOT=Path(__file__).resolve().parent.parent
SRC=ROOT/'content/astrology/globe/sources'; OUT=ROOT/'apps/web/public/globe'
OUT.mkdir(parents=True,exist_ok=True)
features=json.loads((SRC/'ne_50m_admin_0_countries.geojson').read_text())['features']
atlas=json.loads((ROOT/'content/astrology/atlas/manifest.geonames-world.2026-10-11.json').read_text())['countries']
continents={}
for line in (ROOT/'content/astrology/atlas/source-countries.tsv').read_text().splitlines():
 if line and not line.startswith('#'):
  row=line.split('\t');continents[row[0]]=row[8]
region_names={'EU':'europe','AS':'asia','AF':'africa','NA':'north-america','SA':'south-america','OC':'oceania'}
mid=set('AE BH CY EG IL IQ IR JO KW LB OM PS QA SA SY TR YE'.split())
bycode={}
for f in features:
 p=f['properties'];code=p['ISO_A2_EH']
 if code=='-99':code={'Kosovo':'XK','Somaliland':'SO','N. Cyprus':'CY'}.get(p['NAME'],p['ISO_A2'])
 if code in atlas:
  polys=f['geometry']['coordinates'] if f['geometry']['type']=='MultiPolygon' else [f['geometry']['coordinates']]
  bycode.setdefault(code,[]).extend(polys)
def norm(n):return (n+180)%360-180
def focus(polys):
 pts=[p for poly in polys for p in poly[0]]
 lons=sorted(set((p[0]+360)%360 for p in pts));gaps=[((lons[(i+1)%len(lons)]-v)%360,i) for i,v in enumerate(lons)]
 gap,i=max(gaps);west=lons[(i+1)%len(lons)];span=360-gap
 south=min(p[1] for p in pts);north=max(p[1] for p in pts);lat=(south+north)/2;lon=norm(west+span/2)
 radius=max(math.degrees(math.acos(max(-1,min(1,math.sin(math.radians(lat))*math.sin(math.radians(p[1]))+math.cos(math.radians(lat))*math.cos(math.radians(p[1]))*math.cos(math.radians(p[0]-lon)))))) for p in pts)
 return {'latitude':round(lat,4),'longitude':round(lon,4),'angularRadius':round(radius,4),'west':round(norm(west),4),'longitudeSpan':round(span,4),'south':round(south,4),'north':round(north,4)}
countries=[]
for code,a in atlas.items():
 regions=[region_names[continents[code]]] if continents.get(code) in region_names else []
 if code in mid:regions.append('middle-east')
 if code in ['RU','TR','KZ','GE','AZ','AM']:
  regions=list(dict.fromkeys(regions+['europe','asia']))
 polys=bycode.get(code,[])
 countries.append({'code':code,'label':a['label'],'regions':regions,'geometryStatus':'available' if polys else 'missing','focus':focus(polys) if polys else None})
geo={'version':'ne-5.1.2-etopo1-v1','countries':countries,'polygons':{c:[[[[round(x,4),round(y,4)] for x,y in ring] for ring in poly] for poly in polys] for c,polys in bycode.items()}}
(OUT/'geography.json').write_text(json.dumps(geo,separators=(',',':'))+'\n')
# The complete retained source sample is grid/node registered, 1081 by 541, south first.
rows=csv.reader(io.StringIO(gzip.decompress((SRC/'etopo1.csv.gz').read_bytes()).decode()));next(rows);next(rows)
heights=[int(float(row[2])) for row in rows]
assert len(heights)==1081*541
# Runtime field is north-first with a duplicated seam endpoint.
heights=[v for y in range(540,-1,-1) for v in heights[y*1081:(y+1)*1081]]
(OUT/'elevation.i16').write_bytes(struct.pack('<'+str(len(heights))+'h',*heights))
room_heights=[heights[y*1081+x] for y in range(0,541,2) for x in range(0,1081,2)]
(OUT/'elevation-room.i16').write_bytes(struct.pack('<'+str(len(room_heights))+'h',*room_heights))
W,H=2048,1024
rng=random.Random(63067)
im=Image.new('RGB',(W,H));pixels=im.load()
for y in range(H):
 for x in range(W):
  n=rng.randrange(-5,6)+int(2*math.sin(x*.03)*math.sin(y*.041));pixels[x,y]=(113+n,119+n,98+n)
d=ImageDraw.Draw(im)
def paths(ring):
 # Unwrap before painting; repeat across the seam. No spurious dateline stripe.
 points=[];prev=ring[0][0]
 for lon,lat in ring:
  lon=prev+norm(lon-prev);prev=lon;points.append(((lon+180)/360*W,(90-lat)/180*H))
 return [[(x+offset,y) for x,y in points] for offset in [-W,0,W]]
for f in features:
 polys=f['geometry']['coordinates'] if f['geometry']['type']=='MultiPolygon' else [f['geometry']['coordinates']]
 for poly in polys:
  for ri,ring in enumerate(poly):
   for points in paths(ring):d.polygon(points,fill=(185,165,116) if ri==0 else (113,119,98));d.line(points,fill=(91,78,48),width=1)
# Fine parchment fibres and restrained geographic gilding are original procedural work.
pixels=im.load()
for y in range(H):
 for x in range(W):
  c=pixels[x,y];n=rng.randrange(-5,6)
  gx=min(1080,round(x/(W-1)*1080));gy=min(540,round(y/(H-1)*540))
  h=heights[gy*1081+gx]
  if c[0]>150 and h>0:
   west=heights[gy*1081+max(0,gx-1)];east=heights[gy*1081+min(1080,gx+1)]
   north=heights[max(0,gy-1)*1081+gx];south=heights[min(540,gy+1)*1081+gx]
   n+=max(-28,min(20,int((west-east+north-south)/120)))
   n-=int(max(0,h-1200)/700)
  pixels[x,y]=tuple(max(0,min(255,v+n)) for v in c)
d=ImageDraw.Draw(im)
for lon in range(-180,180,15):
 x=(lon+180)*W/360;d.line([(x,0),(x,H)],fill=(146,137,100),width=1)
for lat in range(-75,90,15):
 y=(90-lat)*H/180;d.line([(0,y),(W,y)],fill=(146,137,100),width=1)
# Pillow bundled bitmap font avoids workstation-dependent fonts.
font=ImageFont.load_default(size=15)
for text,lon,lat in [('ATLANTIC OCEAN',-35,0),('PACIFIC OCEAN',-135,5),('INDIAN OCEAN',75,-25),('ARCTIC OCEAN',10,78)]:
 d.text(((lon+180)*W/360,(90-lat)*H/180),text,font=font,fill=(70,79,66),anchor='mm')
country_font=ImageFont.load_default(size=11)
occupied=[]
for c in sorted(countries,key=lambda c:c['focus']['angularRadius'] if c['focus'] else 0,reverse=True):
 if c['focus'] and c['focus']['angularRadius']>5 and c['code'] not in ['FR','US','NZ','NO']:
  f=next((f for f in features if f['properties']['ISO_A2_EH']==c['code']),None)
  if f:
   p=f['properties'];x=(p['LABEL_X']+180)*W/360;y=(90-p['LABEL_Y'])*H/180
   text=p['NAME'].upper()
   box=d.textbbox((x,y),text,font=country_font,anchor='mm');box=(box[0]-3,box[1]-3,box[2]+3,box[3]+3)
   if any(not(box[2]<r[0] or box[0]>r[2] or box[3]<r[1] or box[1]>r[3]) for r in occupied):continue
   occupied.append(box);d.text((x,y),text,font=country_font,fill=(77,61,36),anchor='mm')
# Original compass engraving in the south Atlantic.
cx,cy=(155/360*W),(130/180*H)
for radius in [31,34]:d.ellipse((cx-radius,cy-radius,cx+radius,cy+radius),outline=(159,128,66),width=1)
for i in range(16):
 a=i*math.pi/8;r=28 if i%2==0 else 16
 tip=(cx+math.sin(a)*r,cy-math.cos(a)*r)
 left=(cx+math.sin(a-.4)*5,cy-math.cos(a-.4)*5)
 right=(cx+math.sin(a+.4)*5,cy-math.cos(a+.4)*5)
 d.polygon([tip,left,(cx,cy)],fill=(76,71,48));d.polygon([tip,right,(cx,cy)],fill=(183,157,96))
d.text((cx,cy-45),'N',font=font,fill=(65,66,44),anchor='mm')
im.save(OUT/'parchment.png',optimize=True)
im.resize((1024,512),Image.Resampling.LANCZOS).save(OUT/'parchment-room.png',optimize=True)
bump=Image.new('L',(1081,541));bump.putdata([max(0,min(255,round(max(0,v)/8500*220)+rng.randrange(0,8))) for v in heights]);bump.save(OUT/'relief-bump.png',optimize=True);bump.resize((541,271),Image.Resampling.LANCZOS).save(OUT/'relief-bump-room.png',optimize=True)
wood=Image.new('RGB',(256,256));wp=wood.load();brass=Image.new('L',(256,256));bp=brass.load()
for y in range(256):
 for x in range(256):
  grain=int(8*math.sin(x*.19+4*math.sin(y*.008))+4*math.sin(x*.9+y*.017))+rng.randrange(-3,4)
  wp[x,y]=(64+grain,35+grain//2,21+grain//3);bp[x,y]=135+rng.randrange(-16,17)+int(15*math.sin(x*.16)*math.sin(y*.11))
wood.save(OUT/'walnut.png',optimize=True);brass.save(OUT/'brass-roughness.png',optimize=True)
meta=json.dumps(countries,separators=(',',':'))
(ROOT/'packages/contracts/src/globe-geography.ts').write_text('''// Generated metadata: regenerate with python3 scripts/build-globe.py.\nexport type GlobeRegion = 'europe'|'asia'|'middle-east'|'africa'|'north-america'|'south-america'|'oceania';\nexport type GeographicFocus = { latitude:number; longitude:number; angularRadius:number; west?:number; longitudeSpan?:number; south?:number; north?:number };\nexport type GlobeCountry = {code:string;label:string;regions:GlobeRegion[];geometryStatus:'available'|'missing';focus:GeographicFocus|null};\nexport const globeRegions: {id:GlobeRegion;label:string;focus:GeographicFocus}[] = [\n{id:'europe',label:'Europe',focus:{latitude:50,longitude:20,angularRadius:30}},\n{id:'asia',label:'Asia',focus:{latitude:35,longitude:100,angularRadius:56}},\n{id:'middle-east',label:'Middle East',focus:{latitude:29,longitude:43,angularRadius:28}},\n{id:'africa',label:'Africa',focus:{latitude:2,longitude:20,angularRadius:42}},\n{id:'north-america',label:'North America',focus:{latitude:43,longitude:-100,angularRadius:54}},\n{id:'south-america',label:'South America',focus:{latitude:-22,longitude:-60,angularRadius:40}},\n{id:'oceania',label:'Oceania',focus:{latitude:-23,longitude:160,angularRadius:49}}];\nexport const globeCountries:GlobeCountry[] = '''+meta+''';\nexport function normalizeLongitude(value:number){return ((value+180)%360+360)%360-180;}\nexport function geographicVector(latitude:number,longitude:number,radius=1):[number,number,number]{const lat=latitude*Math.PI/180,lon=longitude*Math.PI/180;return [radius*Math.cos(lat)*Math.sin(lon),radius*Math.sin(lat),radius*Math.cos(lat)*Math.cos(lon)];}\nexport function vectorGeography(x:number,y:number,z:number){const radius=Math.hypot(x,y,z);return {latitude:Math.asin(Math.max(-1,Math.min(1,y/radius)))*180/Math.PI,longitude:normalizeLongitude(Math.atan2(x,z)*180/Math.PI)};}\n''')
manifest={'version':geo['version'],'sources':[{'file':'sources/ne_50m_admin_0_countries.geojson','url':'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson','license':'Public domain','attribution':'Natural Earth 5.1.2, de facto boundaries; no sovereignty endorsement'},{'file':'sources/etopo1.csv.gz','url':'https://coastwatch.pfeg.noaa.gov/erddap/griddap/etopo180.csv?altitude%5B(90):20:(-90)%5D%5B(-180):20:(180)%5D','license':'NOAA freely usable and redistributable; no warranty; not for legal use','attribution':'Amante, C. and B. W. Eakins, ETOPO1, NOAA NGDC-24 (2009); NOAA NGDC, WGS84 / mean sea level, ice surface'}], 'outputs':[], 'grid':{'width':1081,'height':541,'encoding':'little-endian signed int16 metres, north first, duplicated seam','sampleDegrees':1/3},'missingGeometry':[c['code'] for c in countries if c['geometryStatus']=='missing'],'transform':'python3 scripts/build-globe.py; Python 3; Pillow 12.3.0; deterministic seed 63067; no network; CPU elevation linear land-only displacement'}
for entry in manifest['sources']:entry['sha256']=hashlib.sha256((ROOT/'content/astrology/globe'/entry['file']).read_bytes()).hexdigest()
for p in sorted(OUT.iterdir()):
 data=p.read_bytes();entry={'file':p.name,'bytes':len(data),'gzipBytes':len(gzip.compress(data,mtime=0)),'sha256':hashlib.sha256(data).hexdigest()}
 if p.suffix=='.png':
  image=Image.open(p);entry.update({'width':image.width,'height':image.height,'colorSpace':'none' if p.name in ['relief-bump.png','relief-bump-room.png','brass-roughness.png'] else 'sRGB','magnification':'nearest'})
 manifest['outputs'].append(entry)
(ROOT/'content/astrology/globe/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Generated',len(countries),'atlas entries;',len(bycode),'geometries; missing:',manifest['missingGeometry'])
