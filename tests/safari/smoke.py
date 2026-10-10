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
 for slot in [1,13,78]:
  wait(lambda:execute(f"return !document.querySelector('[aria-label=\"Choose slot {slot}\"]').disabled"));click(f'[aria-label="Choose slot {slot}"]')
 for card in [1,2,3]:
  wait(lambda:execute(f"return document.querySelector('[aria-label=\"Reveal card {card}\"]') && !document.querySelector('[aria-label=\"Reveal card {card}\"]').disabled"));click(f'[aria-label="Reveal card {card}"]')
 wait(lambda:execute("return document.querySelector('.synthesis')!==null"));screenshot('tarot.png')
 visit('/astrology/');wait(lambda:execute("return !!document.querySelector('canvas') && !!document.querySelector('input[name=date]')"))
 execute("for (const [name,value] of Object.entries({date:'2000-01-01',time:'12:00',timezone:'UTC',latitude:'0',longitude:'0'})) document.querySelector('[name='+name+']').value=value;")
 click('button.primary');wait(lambda:execute("return document.querySelectorAll('.planets button').length===10"))
 assert 'Capricorn' in execute("return document.querySelector('.planets button').textContent")
 screenshot('astrology.png');(out/'result.json').write_text(json.dumps({'passed':True,'checks':['landing','real tarot WASM selection/reveal','real astrology WASM ten-body chart'],'scope':'actual Safari on hosted macOS; not iOS or physical mobile'},indent=2));print('Actual Safari smoke checks passed')
finally:
 if session:
  try:request('DELETE',f'/session/{session}')
  except Exception:pass
 driver.terminate();server.terminate()
