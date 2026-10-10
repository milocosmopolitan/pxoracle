import swisseph as s,json,subprocess,pathlib
rows=[];errors={'longitudeDeg':0,'latitudeDeg':0,'speedDegDay':0,'angleDeg':0}
for date,time,lat,lon in [('1900-01-01','00:00',51.5,0),('1950-06-30','03:45',35.18,129.07),('2000-01-01','12:00',0,0),('2024-03-20','03:06',40.7,-74),('2050-07-01','18:30',-33.87,151.21),('2100-12-31','23:59',64,-21)]:
 inp=dict(date=date,time=time,timezone='UTC',latitude=lat,longitude=lon,accuracy='exact',fold=None,uncertaintyMinutes=None)
 chart=json.loads(subprocess.check_output(['target/debug/examples/dispatch'],input=json.dumps(inp).encode()))
 y,m,d=map(int,date.split('-'));h,mi=map(int,time.split(':'));jd=s.julday(y,m,d,h+mi/60);tt=2451545+chart['provenance']['ttDays']
 bodies=[]
 for i,b in enumerate(chart['bodies']):
  p,flags=s.calc(tt,i,s.FLG_MOSEPH|s.FLG_SPEED)
  bodies.append(dict(id=b['id'],longitude=p[0],latitude=p[1],speed=p[3]))
  for key,k in [('longitude','longitudeDeg'),('latitude','latitudeDeg'),('speed','speedDegDay')]:
   err=abs((b[key]-bodies[-1][key]+180)%360-180) if key=='longitude' else abs(b[key]-bodies[-1][key]);errors[k]=max(errors[k],err)
 cusps,ang=s.houses_ex(jd,lat,lon,b'W');angles=dict(asc=ang[0],mc=ang[1])
 for k in angles:errors['angleDeg']=max(errors['angleDeg'],abs((angles[k]-chart['angles'][k]+180)%360-180))
 rows.append(dict(input=inp,utJulianDay=jd,ttJulianDay=tt,bodies=bodies,angles=angles,cusps=cusps))
pathlib.Path('tests/fixtures/astronomy-reference.json').write_text(json.dumps(dict(reference='Swiss Ephemeris '+s.version,pythonPackage='pyswisseph 2.10.3.2',flags='FLG_MOSEPH | FLG_SPEED',conditions='apparent geocentric tropical ecliptic/equinox of date; planetary TT matched explicitly to production backend; houses UT uses UTC-as-UT1; east-positive geographic longitude',source='https://www.astro.com/swisseph/swephprg.htm',cases=rows),indent=2)+'\n')
print(errors)
pathlib.Path('docs/validation/astronomy-reference-errors.json').write_text(json.dumps(errors,indent=2)+'\n')
