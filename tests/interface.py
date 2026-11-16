from playwright.sync_api import sync_playwright
from pathlib import Path
import json,os,urllib.request
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 page=b.new_page(viewport={'width':1440,'height':1000});page.set_default_timeout(120000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 url=os.environ.get('ANILOOP_URL','http://localhost:8097');page.goto(url);page.locator('.hero').wait_for();page.screenshot(path=str(root/'qa/english-home.png'),full_page=True)
 assert page.locator('html').get_attribute('lang')=='en';assert 'Choose your next challenge' in page.locator('body').inner_text()
 page.locator('[data-action="play:screenshot"]').first.click();page.locator('#answer').fill('naruto');page.locator('.suggestions:not([hidden]) [role="option"]').first.wait_for();page.locator('#answer').press('ArrowDown');page.locator('#answer').press('Enter');assert page.locator('#answer').input_value();page.wait_for_function('document.querySelector(".question-image").naturalWidth>0');page.screenshot(path=str(root/'qa/english-game.png'),full_page=True)
 # Deterministic local source: exercise encoded cover and clipped video via actual UI.
 pool=json.loads((root/'data/pool.json').read_text())['anime'];item=next(a for a in pool if (a.get('ending') or {}).get('video','').startswith('assets/media/'))
 page.evaluate('''id=>{let s=JSON.parse(localStorage.getItem('aniloop-state-v1'));s.infinity.games.ending.questions[0]=id;s.infinity.games.ending.hints=[];s.infinity.games.ending.musicMode='audio';localStorage.setItem('aniloop-state-v1',JSON.stringify(s));}''',item['id'])
 page.reload();page.locator('[data-action="play:ending"]').first.click();page.locator('audio').wait_for();page.wait_for_function('document.querySelector("audio").duration>70')
 page.locator('[data-action="hint:1"]').click();page.wait_for_function('document.querySelector(".quiz-video").readyState>=2',timeout=180000)
 assert page.locator('.quiz-video').get_attribute('src').startswith('/hints/')
 assert page.locator('.ending-cover img').get_attribute('src').startswith('/hints/')
 data=page.locator('.quiz-video').evaluate('(v)=>({duration:v.duration,src:v.currentSrc,offset:v.dataset.offset,blur:getComputedStyle(v).filter})');print('HINT',data);assert 70<data['duration']<120;assert data['blur']=='none'
 req=urllib.request.Request(data['src'],headers={'Range':'bytes=100-199'})
 with urllib.request.urlopen(req) as response:assert response.status==206 and len(response.read())==100
 page.locator('.quiz-video').evaluate('(v)=>{v.style.filter="none";v.currentTime=500;}');assert page.locator('.quiz-video').evaluate('(v)=>v.currentTime<=v.duration')
 page.screenshot(path=str(root/'qa/english-ending.png'),full_page=True)
 for width in [320,390,768]:
  page.set_viewport_size({'width':width,'height':900});page.wait_for_timeout(100)
  print('WIDTH',width,page.evaluate('({body:document.documentElement.scrollWidth,viewport:innerWidth})'))
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 page.screenshot(path=str(root/'qa/english-mobile.png'),full_page=True)
 print('PASS: English UI, keyboard suggestions, encoded hints, complete ending video, byte ranges, and responsive layouts');assert not errors
 b.close()
