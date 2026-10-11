"""Build runtime WebP copies; originals remain unchanged. Usage: python scripts/import-assets.py SOURCE_DIRECTORY"""
from pathlib import Path
from PIL import Image
import hashlib,json,sys
source=Path(sys.argv[1]); root=Path(__file__).resolve().parent.parent
out=root/'apps/web/public/art';out.mkdir(parents=True,exist_ok=True)
manifest={'schemaVersion':1,'deckId':'pxoracle.standard.v1','approval':'User supplied for PXOracle implementation, 2026-10-10. No redistribution license inferred.','assets':{},'cards':{}}
if '--scenes-only' in sys.argv:
 manifest=json.loads((out/'manifest.json').read_text())
def export(key,p,maxsize=1024):
 im=Image.open(p).convert('RGBA');original=im.size
 im.thumbnail((maxsize,maxsize),Image.Resampling.NEAREST)
 target=out/(key+'.webp');target.parent.mkdir(parents=True,exist_ok=True);temporary=target.with_suffix('.importing.tmp');im.save(temporary,format='WEBP',lossless=True,method=6);temporary.replace(target)
 manifest['assets'][key]={'url':'/art/'+key+'.webp','source':str(p.relative_to(source) if p.is_relative_to(source) else p.relative_to(root)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'originalSize':original,'size':im.size,'bytes':target.stat().st_size}
 return '/art/'+key+'.webp'
files={
 'room':'environment/Empty retro oracle study room-1.png',
 'table':'environment/Retro dark walnut table.png',
 'lamp':'environment/Aged bronze desk lamp.png',
 'plant':'environment/Olive-leaved houseplant in terracotta.png',
 'oracle':'oracle/talk/oracle-talk-rest.png',
 'oracle-smile':'oracle/smile/oracle-smile-gentle-smile.png',
 'oracle-gaze':'oracle/look-down/oracle-look-down-table-gaze.png',
 'crystal':'crystal-ball/crystal-ball-idle.png',
 'crystal-active':'crystal-ball/crystal-ball-astrology-mode.png',
 'deck':'tabletop/Teal Tarot Deck with Bronze Border.png',
 'mat':'tabletop/Worn teal reading mat.png',
 'mug':'environment/Handmade charcoal mug, retro pixel art.png',
 'notebook':'environment/Open cloth-bound notebook with blank pages.png',
 'pen':'tabletop/Charcoal fountain pen with bronze clip.png',
 'tray':'tabletop/Empty walnut tray.png',
 'three-cards':'tabletop/Three Face-Down Teal Tarot Cards.png',
 'door/closed':'door/ChatGPT Image Oct 10, 2026, 02_43_26 PM.png',
 'door/ajar':'door/ChatGPT Image Oct 10, 2026, 02_43_39 PM.png',
 'door/half':'door/ChatGPT Image Oct 10, 2026, 02_43_31 PM.png',
 'door/open':'door/ChatGPT Image Oct 10, 2026, 02_43_36 PM.png',
 'door/frame':'door/ChatGPT Image Oct 10, 2026, 02_43_43 PM.png',
 'door/glow':'door/ChatGPT Image Oct 10, 2026, 02_43_46 PM.png'}
for k,p in files.items():
 path=source/p
 if not path.exists():
  if k.startswith('oracle-'):continue
  raise FileNotFoundError(path)
 export(k,path,1600 if k=='room' else 900)
for key in ['candle','cat-chair','runner','moon-frame']:
 p=root/'assets/sources/concept-additions'/(key+'.png')
 if p.exists():
  export(key,p,900)
  manifest['assets'][key]['origin']='Generated with Imagegen from user-supplied concept, 2026-10-10; supplemental artwork, not an original supplied prop.'
  manifest['assets'][key]['reference']='1654eae3-aa67-4e53-8bb3-00e7158e905b.png'
for key in ['hand', 'surface', 'back']:
 p=out/'tarot-table'/(key+'.png')
 if p.exists():
  manifest['assets']['tarot-'+key]={'url':'/art/tarot-table/'+key+'.png','source':str(p.relative_to(root)),'origin':'Generated with OpenAI image_gen, 2026-10-10; see docs/assets/tarot-table.md','sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'size':Image.open(p).size,'bytes':p.stat().st_size}
if '--scenes-only' in sys.argv:
 (root/'assets/manifests/art.json').write_text(json.dumps(manifest,indent=2)+'\n')
 (out/'manifest.json').write_text(json.dumps(manifest,separators=(',',':')))
 print('Imported',len(files),'scene assets; preserved card artwork and content.')
 sys.exit(0)
majors=['Fool','Magician','High Pristese','Empress','Emperor','Teacher','Lovers','Chariot','Strength','Hermit','Wheel','Justice','Hanged','Death','Temperance','Devil','Tower','Star','Moon XVIII','Sun and','Judgement','World']
major_names=['The Fool','The Magician','The High Priestess','The Empress','The Emperor','The Teacher','The Lovers','The Chariot','Strength','The Hermit','Wheel of Fortune','Justice','The Hanged Man','Death','Temperance','The Devil','The Tower','The Star','The Moon','The Sun','Judgement','The World']
major_themes=['beginnings','agency','intuition','nurturing','structure','guidance','values','direction','courage','reflection','change','fairness','perspective','transition','balance','attachment','disruption','hope','uncertainty','vitality','renewal','integration']
content={'version':'en.v1','locale':'en','cards':{},'positions':{'focus':'What deserves your attention?','situation':'What is present in this situation?','examination':'What deserves a closer look?','next_action':'What small action is available to you?'}}
authored_content=root/'content/tarot/en.v1.json'
if authored_content.exists():
 content=json.loads(authored_content.read_text())
def card(cid,p,name,theme):
 url=export('cards/'+cid,p,768);manifest['cards'][cid]={'name':name,'url':url}
 if cid not in content['cards']:raise ValueError('Missing authored reading for '+cid)
for n,match in enumerate(majors):
 matches=[p for p in (source/'tarot/major arcana').glob('*.png') if match.lower() in p.name.lower()]
 assert len(matches)==1,(match,matches)
 card(f'major.{n:02}',matches[0],major_names[n],major_themes[n])
ranks=['Ace','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Page','Knight','Queen','King']
rank_themes=['potential','choice','growth','stability','challenge','support','assessment','movement','culmination','completion','curiosity','pursuit','care','stewardship']
suits={'wand':'wands','cup':'cups','sword':'swords','pentacle':'pentacles'}
for singular,suit in suits.items():
 for p in (source/f'tarot/minor arcana - {singular}').glob('*.png'):
  name=p.name.lower();n=next((i+1 for i,r in enumerate(ranks) if r.lower() in name),None)
  if n is None:
   if name.startswith('sword1') or name.startswith('golden pentacle'):n=1
   elif 'curious traveler' in name:n=11
  assert n is not None,p
  cid=f'{suit}.{n:02}';assert cid not in manifest['cards'],cid
  card(cid,p,f'{ranks[n-1]} of {suit.title()}',rank_themes[n-1]+' in '+{'wands':'creativity and intention','cups':'feelings and connection','swords':'thought and communication','pentacles':'practical life and resources'}[suit])
assert len(manifest['cards'])==78
(root/'assets/manifests').mkdir(parents=True,exist_ok=True)
(root/'assets/manifests/art.json').write_text(json.dumps(manifest,indent=2)+'\n')
(out/'manifest.json').write_text(json.dumps(manifest,separators=(',',':')))
(root/'content/tarot').mkdir(parents=True,exist_ok=True)
(root/'content/tarot/en.v1.json').write_text(json.dumps(content,indent=2)+'\n')
(root/'apps/web/public/content').mkdir(parents=True,exist_ok=True)
(root/'apps/web/public/content/tarot.en.v1.json').write_text(json.dumps(content,separators=(',',':')))
print(len(manifest['cards']),'cards;',sum(x['bytes'] for x in manifest['assets'].values()),'runtime bytes')
