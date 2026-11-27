from privacy_fixture import open_app
"""Large catalogue pagination, on-demand source cache and configurable opening bounds."""
from pathlib import Path
import os,json,urllib.request
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];PACK=json.loads((ROOT/'data/pool.json').read_text(encoding='utf-8'));URL=os.environ.get('ANILOOP_URL','http://localhost:8097')
def click(p,a):p.locator(f'[data-action="{a}"]:visible').first.click()
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True);p=b.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce');errors=[];p.set_default_timeout(120000);p.on('pageerror',lambda e:errors.append(str(e)))
 p.route('https://fonts.googleapis.com/**',lambda r:r.abort());p.route('https://fonts.gstatic.com/**',lambda r:r.abort());open_app(p,URL,wait_until='networkidle')
 click(p,'library');expect(p.locator('.library-item')).to_have_count(60)
 first=p.locator('.library-item h3').first.inner_text();click(p,'library-page:2');assert p.locator('.library-item h3').first.inner_text()!=first
 p.locator('#library-category').select_option('screenshot');expect(p.locator('#pool-results')).to_contain_text(str(sum(bool(a['screenshots']) for a in PACK['anime']))+' results')
 p.locator('#library-search').fill('Naruto');expect(p.locator('#pool-results')).not_to_contain_text(str(sum(bool(a['screenshots']) for a in PACK['anime']))+' results');expect(p.locator('.library-item').first).to_contain_text('Naruto')
 assert p.locator('.library-item').count()<=60
 p.screenshot(path=str(ROOT/'qa/large-pool-search.png'),full_page=True)
 print(f'PASS: {len(PACK["anime"]):,}-entry catalogue uses 60-item pages, category filtering and search')
 # Verify one newly registered screenshot is fetched, displayed and reused locally.
 source=next(src for a in PACK['anime'] for src in a['screenshots'] if src.startswith('media/'))
 image=p.evaluate('''async src=>{const img=new Image();img.src=src;await img.decode();return [img.naturalWidth,img.naturalHeight];}''',source)
 assert image[0]>0 and image[1]>0
 cache=ROOT/'.tools/media-cache'/source[6:];assert cache.exists();before=cache.stat().st_ino
 with urllib.request.urlopen(URL+'/'+source) as response:assert response.status==200 and len(response.read())>100
 assert cache.stat().st_ino==before
 try:urllib.request.urlopen(URL+'/media/not-registered.mp4');raise AssertionError('Unknown source accepted')
 except urllib.error.HTTPError as e:assert e.code==404
 print('PASS: real remote screenshot decodes, cache is reused, unknown source IDs are rejected')
 # Save a concrete per-opening time window through the real editor.
 target=next(a for a in PACK['anime'] if a['id']=='anime-138')
 p.locator('#library-category').select_option('all');p.locator('#library-search').fill(target['title']);p.wait_for_timeout(250)
 click(p,'edit:'+target['id']);p.locator('#opening-start').fill('20');p.locator('#opening-end').fill('40')
 p.locator('form[data-form=editor] button[type=submit]').click();expect(p.locator('#toast')).to_contain_text('Media saved')
 saved=p.evaluate('''async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('aniloop-media',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return await new Promise(resolve=>{const r=db.transaction('packs').objectStore('packs').get('custom');r.onsuccess=()=>resolve(r.result);});}''')
 a=next(a for a in saved['anime'] if a['id']==target['id']);assert a['opening']['videoWindow']=={'startSeconds':20,'endSeconds':40}
 print('PASS: opening time window 20–40 seconds is saved to the media pack')
 assert not errors,errors;b.close();print('ALL LARGE-POOL CHECKS PASSED')
