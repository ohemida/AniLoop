from privacy_fixture import open_app
"""Real-media browser regression. Start python3 server.py first."""
from pathlib import Path
import json,os,base64,re
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'qa';OUT.mkdir(exist_ok=True)
PACK=json.loads((ROOT/'data/pool.json').read_text());ANIME={a['id']:a for a in PACK['anime']}
URL=os.environ.get('ANILOOP_URL','http://localhost:8097')
def click(p,action):p.locator(f'[data-action="{action}"]:visible').first.click()
def state(p):return p.evaluate("JSON.parse(localStorage.getItem('aniloop-state-v1'))")
def current(p,c):return state(p)['infinity']['games'][c]
def answer(p,title):
 p.locator('#answer').fill(title)
 p.locator('form[data-form="anime"] button[type="submit"],form[data-form="anidle"] button[type="submit"]').click()
def points(text,n):expect(text).to_contain_text(re.compile(str(n//1000)+r'[,\s]'+f'{n%1000:03}' if n>=1000 else str(n)))
def finish(p,n):click(p,'home' if n==2 else 'continue')
def play(p,selector='audio'):
 media=p.locator(selector).first
 media.evaluate('(m)=>m.play()')
 p.wait_for_function('(s)=>{const m=document.querySelector(s);return m&&m.currentTime>0.1&&!m.paused}',arg=selector)
 media.evaluate('(m)=>m.pause()')
 assert media.evaluate('(m)=>m.duration')>24
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True)
 ctx=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce')
 p=ctx.new_page();errors=[]
 p.set_default_timeout(120000);p.on('pageerror',lambda e:errors.append(str(e)))
 p.route('https://fonts.googleapis.com/**',lambda r:r.abort());p.route('https://fonts.gstatic.com/**',lambda r:r.abort())
 open_app(p,URL,wait_until='networkidle')
 expect(p.locator('.category-card')).to_have_count(5)
 expect(p.locator('[data-action="next"]').first).to_be_disabled()
 assert 'Demo-Medienpaket' not in p.locator('main').inner_text()
 p.screenshot(path=str(OUT/'dark-desktop.png'),full_page=True)
 print('PASS: real-media dashboard, sidebar, initial Infinity lock')
 click(p,'play:screenshot');initial=current(p,'screenshot')
 expect(p.locator('.difficulty').first).to_have_text('Easy')
 original=p.locator('.question-image').get_attribute('src')
 click(p,'hint:1');hint=p.locator('.question-image').get_attribute('src');assert hint!=original
 click(p,'view-frame:0');assert p.locator('.question-image').get_attribute('src')==original
 p.reload(wait_until='networkidle');click(p,'play:screenshot')
 expect(p.locator('[data-action="view-frame:1"]')).to_have_class('unlocked')
 assert current(p,'screenshot')['frames']==initial['frames']
 for n in range(3):
  g=current(p,'screenshot');expect(p.locator('.difficulty').first).to_have_text(['Easy','Medium','Hard'][n])
  p.wait_for_function('()=>document.querySelector(".question-image").naturalWidth>0')
  if n==0:p.screenshot(path=str(OUT/'dark-screenshot.png'),full_page=True)
  answer(p,ANIME[g['questions'][n]]['title'])
  if n<2:points(p.locator('.result-score'),7500 if n==0 else 10000)
  else:
   points(p.locator('.category-score>strong'),27500);expect(p.locator('.round-result')).to_have_count(3)
   p.screenshot(path=str(OUT/'dark-results.png'),full_page=True)
  finish(p,n)
 expect(p.locator('[data-action="next"]').first).to_be_disabled()
 print('PASS: real screenshots, distinct hints, frame persistence, levels and results')
 click(p,'play:character')
 for n in range(3):
  g=current(p,'character')
  for i,id in enumerate(g['questions'][n]):
   a=ANIME[id];c=next(c for c in a['characters'] if c['id']==g['characterRefs'][n][i])
   p.locator(f'#anime-{i}').fill(a['title'])
   if n>0:p.locator(f'#character-{i}').fill(c['name'])
  p.locator('#anime-3').press('Escape')
  assert p.locator('.character-grid img').count()==4
  p.locator('form[data-form="characters"] button[type="submit"]').click()
  if n<2:points(p.locator('.result-score'),2000 if n==0 else 10000)
  else:points(p.locator('.category-score>strong'),22000)
  finish(p,n)
 print('PASS: real portraits, selected character variants and partial scores')
 for category in ['opening','ending']:
  click(p,'play:'+category)
  for n in range(3):
   g=current(p,category);play(p)
   if n==0 and category=='opening':
    click(p,'hint:1');p.wait_for_function('()=>document.querySelector(".quiz-video").dataset.positioned==="true"');play(p,'video');p.screenshot(path=str(OUT/'dark-opening.png'),full_page=True)
   if n==0 and category=='ending':click(p,'giveup');points(p.locator('.result-score'),0)
   else:answer(p,ANIME[g['questions'][n]]['title'])
   if n==2:points(p.locator('.category-score>strong'),12500 if category=='opening' else 10000)
   finish(p,n)
  expect(p.locator('[data-action="next"]').first).to_be_disabled()
 print('PASS: genuine MP3 and MP4 decode and play; OP/ED scores and hints')
 click(p,'play:anidle');target=current(p,'anidle')['questions'][0]
 wrong=[a for a in PACK['anime'] if a['id']!=target and a['score'] is not None][:3]
 for a in wrong:answer(p,a['title'])
 expect(p.locator('.comparison-wrap .comparison tbody tr')).to_have_count(3)
 answer(p,wrong[0]['title']);expect(p.locator('#toast')).to_contain_text('already guessed')
 click(p,'skip-anidle');assert current(p,'anidle')['attempt']==13
 p.wait_for_function('()=>document.querySelector(".clue-cover img").naturalWidth>0')
 answer(p,ANIME[target]['title']);points(p.locator('.category-score>strong'),5000)
 click(p,'home');expect(p.locator('.completion')).to_be_visible()
 assert sum(sum(g['scores']) for g in state(p)['infinity']['games'].values())==77000
 previous=state(p)['infinity'];click(p,'next');new=state(p)['infinity']
 assert new['number']==2 and state(p)['history'][0]['score']==77000
 for c in ['screenshot','opening','ending','anidle']:assert not set(previous['games'][c]['questions'])&set(new['games'][c]['questions'])
 expect(p.locator('[data-action="next"]').first).to_be_disabled()
 print('PASS: Anidle, 77,000-point full loop, archive and fresh random next loop')
 click(p,'stats');points(p.locator('main'),77000);click(p,'home');click(p,'mode-daily')
 daily=state(p)['daily']['games'];p.reload(wait_until='networkidle');assert state(p)['daily']['games']==daily
 click(p,'mode-infinity');click(p,'library');edit_id=PACK['anime'][0]['id'];click(p,'edit:'+edit_id)
 expect(p.locator('#media-editor')).to_be_visible()
 png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7WQAAAAASUVORK5CYII=')
 p.locator('[name="screenshot-files"]').set_input_files({'name':'scene.png','mimeType':'image/png','buffer':png})
 p.locator('form[data-form="editor"] button[type="submit"]').click();expect(p.locator('#toast')).to_contain_text('Media saved')
 p.reload(wait_until='networkidle');click(p,'library');expect(p.locator('main')).to_contain_text('My anime media pack')
 with p.expect_download() as result:click(p,'export-pack')
 result.value.save_as(str(OUT/'export.json'));export=json.loads((OUT/'export.json').read_text());assert export['anime'][0]['screenshots'][0].startswith('data:image/png')
 click(p,'import-pack');p.locator('#import-file').set_input_files(str(ROOT/'data/pool.json'));click(p,'confirm-import')
 expect(p.locator('#toast')).to_contain_text('Media pack activated')
 print('PASS: daily persistence, real-pool editor, upload, IndexedDB, export/import')
 click(p,'home')
 for width in [320,390,768,1024]:
  p.set_viewport_size({'width':width,'height':844})
  assert p.evaluate('document.documentElement.scrollWidth <= innerWidth'),f'overflow {width}'
 p.set_viewport_size({'width':390,'height':844});p.locator('#toast').evaluate('(e)=>e.classList.remove("visible")')
 p.screenshot(path=str(OUT/'dark-mobile.png'),full_page=True)
 click(p,'play:character');p.wait_for_load_state('networkidle')
 assert p.evaluate('document.documentElement.scrollWidth <= innerWidth')
 p.screenshot(path=str(OUT/'dark-mobile-characters.png'),full_page=True)
 click(p,'help');expect(p.locator('dialog')).to_be_visible();p.keyboard.press('Escape');expect(p.locator('dialog')).not_to_be_visible()
 assert not errors,errors
 print('PASS: 320/390/768/1024px responsive layouts and no JavaScript errors')
 browser.close();print('ALL REAL-MEDIA BROWSER CHECKS PASSED')
