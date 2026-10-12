"""Actual macOS Safari via the standard W3C WebDriver API; never label WebKit as Safari."""
import base64,json,pathlib,subprocess,time,urllib.request,urllib.error,sys
root=pathlib.Path(sys.argv[1]).resolve(); out=pathlib.Path('safari-results');out.mkdir(exist_ok=True)
server=subprocess.Popen([sys.executable,'-m','http.server','4173','--directory',str(root)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
driver=subprocess.Popen(['/usr/bin/safaridriver','-p','4444'],stdout=(out/'driver.log').open('w'),stderr=subprocess.STDOUT)
session=None

def request(method,path,data=None):
 req=urllib.request.Request('http://127.0.0.1:4444'+path,data=None if data is None else json.dumps(data).encode(),headers={'Content-Type':'application/json'},method=method)
 try:
  with urllib.request.urlopen(req,timeout=40) as response: value=json.load(response).get('value')
 except urllib.error.HTTPError as e:raise RuntimeError(e.read().decode())
 if isinstance(value,dict) and value.get('error'):raise RuntimeError(value)
 return value

def wait(fn):
 end=time.monotonic()+30
 while time.monotonic()<end:
  try:
   value=fn()
   if value:return value
  except (OSError,RuntimeError):pass
  time.sleep(.2)
 raise RuntimeError('Safari condition timed out')

def execute(script):return request('POST',f'/session/{session}/execute/sync',{'script':script,'args':[]})
def click(selector):
 elem=wait(lambda:request('POST',f'/session/{session}/element',{'using':'css selector','value':selector}))
 request('POST',f'/session/{session}/element/{elem["element-6066-11e4-a52e-4f735466cecf"]}/click',{})
def screenshot(name):
 encoded=request('GET',f'/session/{session}/screenshot');(out/name).write_bytes(base64.b64decode(encoded))
def visit(path):request('POST',f'/session/{session}/url',{'url':'http://127.0.0.1:4173'+path})

try:
 wait(lambda:request('GET','/status'))
 created=request('POST','/session',{'capabilities':{'alwaysMatch':{'browserName':'safari'}}});session=created['sessionId']
 (out/'capabilities.json').write_text(json.dumps(created['capabilities'],indent=2))
 visit('/');wait(lambda:execute("return document.querySelector('h1')?.textContent.includes('Some answers')"));screenshot('landing.png')
 visit('/tarot/');wait(lambda:execute("return document.querySelector('button.primary') && !document.querySelector('button.primary').disabled"));click('button.primary')
 wait(lambda:execute("return !!document.querySelector('[aria-label=\"Choose slot 1\"]')"))
 for slot in [1,2,3]:
  wait(lambda:execute(f"return !!document.querySelector('[aria-label=\"Choose slot {slot}\"]:not(:disabled)')"));click(f'[aria-label="Choose slot {slot}"]')
 wait(lambda:execute("return document.querySelectorAll('.structured-reading .reading-card').length===3"));screenshot('tarot.png')
 visit('/astrology/');wait(lambda:execute("return !!Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Natal Chart')"))
 execute("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim().startsWith('Natal Chart')).click()")
 wait(lambda:execute("return !!document.querySelector('.oracle-bubble button')"))
 execute("Array.from(document.querySelectorAll('.oracle-bubble button')).find(b=>b.textContent==='Begin a new chart').click()")
 wait(lambda:execute("return !!document.querySelector('.birthplace-form select') && !document.querySelector('.birthplace-form fieldset').disabled"))
 execute("const el=Array.from(document.querySelectorAll('form label')).find(label=>label.textContent.trim().startsWith('Birth country')).querySelector('select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'KR'); el.dispatchEvent(new Event('change',{bubbles:true}));")
 wait(lambda:execute("return !!document.querySelector('input[type=search]')"))
 execute("const el=document.querySelector('input[type=search]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'Seoul'); el.dispatchEvent(new Event('input',{bubbles:true}));")
 click('.city-results button')
 wait(lambda:execute("return !document.querySelector('.birthplace-form button.primary').disabled"))
 click('.birthplace-form button.primary')
 wait(lambda:execute("return !!document.querySelector('input[name=date]') && !document.querySelector('.birth-details-form fieldset').disabled"))
 execute("for (const [name,value] of Object.entries({date:'2000-01-01',time:'12:00'})) { const el=document.querySelector('[name='+name+']'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value); el.dispatchEvent(new Event('input',{bubbles:true})); }")
 click('.birth-details-form button.primary')
 wait(lambda:execute("return !!document.querySelector('.birth-review button.primary')"))
 click('.birth-review button.primary');wait(lambda:execute("return document.querySelectorAll('.planets button').length===10 && document.querySelector('[aria-label=\"Core interpretation\"]')"))
 assert 'Capricorn' in execute("return document.querySelector('.planets button').textContent")
 assert 'Asia/Seoul' in execute("return document.querySelector('.historical-time').textContent")
 click('.planets button:nth-child(2)');wait(lambda:execute("return !!document.querySelector('[aria-label=\"Selected chart detail\"]')"))
 execute("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Read full HTML report').click()")
 wait(lambda:execute("return !!document.querySelector('.natal-report')"));screenshot('astrology.png')
 execute("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Save on this device').click()")
 wait(lambda:execute("return !!localStorage.getItem('pxoracle.natal-report.v1')"))
 visit('/astrology/');wait(lambda:execute("return !!Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Natal Chart')"))
 execute("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim().startsWith('Natal Chart')).click()")
 wait(lambda:execute("return !!Array.from(document.querySelectorAll('.oracle-bubble button')).find(b=>b.textContent==='Open saved chart')"))
 execute("Array.from(document.querySelectorAll('.oracle-bubble button')).find(b=>b.textContent==='Open saved chart').click()")
 wait(lambda:execute("return !!document.querySelector('[aria-label=\"Core interpretation\"]')"))
 (out/'result.json').write_text(json.dumps({'passed':True,'checks':['landing','real tarot WASM selection/reveal and structured reflection','city selection, real astrology WASM, body detail, full report, save and validated restore'],'scope':'actual Safari on hosted macOS; not iOS or physical mobile'},indent=2));print('Actual Safari smoke checks passed')

finally:
 if session:
  try:request('DELETE',f'/session/{session}')
  except Exception:pass
 driver.terminate();server.terminate()
