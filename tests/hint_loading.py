from privacy_fixture import open_app
from playwright.sync_api import sync_playwright,expect
import json,time,os
from pathlib import Path
root=Path(__file__).resolve().parents[1]
URL=os.environ.get('ANILOOP_URL','http://localhost:8100')
a=next(a for a in json.loads((root/'data/pool.json').read_text(encoding='utf-8'))['anime'] if (a.get('ending') or {}).get('video','').startswith('assets/media/'))
with sync_playwright() as pw:
 b=pw.chromium.launch();p=b.new_page();p.set_default_timeout(120000);calls=[]
 p.on('request',lambda r:calls.append(r.post_data_json) if r.url.endswith('/api/hints') else None)
 open_app(p,URL);p.locator('.hero').wait_for()
 p.evaluate('''id=>{const s=JSON.parse(localStorage.getItem('aniloop-state-v1'));s.infinity.games.ending.questions[0]=id;localStorage.setItem('aniloop-state-v1',JSON.stringify(s));}''',a['id']);p.reload()
 with p.expect_response(lambda r:r.url.endswith('/api/hints') and r.request.post_data_json.get('kind')=='ending') as response:
  p.locator('[data-action="play:ending"]:visible').first.click()
 assert response.value.ok
 assert p.locator('video').count()==0
 assert p.evaluate("JSON.parse(localStorage.getItem('aniloop-state-v1')).infinity.games.ending.hints.length")==0
 count=len([c for c in calls if c['kind']=='ending']);start=time.monotonic();p.locator('[data-action="hint:1"]').click();p.wait_for_function('()=>document.querySelector("video")?.readyState>=2')
 elapsed=time.monotonic()-start
 assert len([c for c in calls if c['kind']=='ending'])==count
 p.locator('button[data-action="media-toggle"]').click();p.wait_for_function('()=>document.querySelector("video").currentTime>.1')
 print('PASS: background hint prepared without unlock/point charge; unlock reused request; video ready in',round(elapsed,2),'seconds; playback works')
 b.close()
