"""Regression for full music, middle-start blurred hints and Anidle clue stages."""
from pathlib import Path
import json,re,urllib.request,os
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];PACK=json.loads((ROOT/'data/pool.json').read_text());ANIME={a['id']:a for a in PACK['anime']}
URL=os.environ.get('ANILOOP_URL','http://localhost:8097')
def click(p,a):p.locator(f'[data-action="{a}"]:visible').first.click()
def state(p):return p.evaluate("JSON.parse(localStorage.getItem('aniloop-state-v1'))")
def game(p,c):return state(p)['infinity']['games'][c]
def submit(p,title):
 p.locator('#answer').fill(title);p.locator('form[data-form="anidle"] button[type=submit],form[data-form="anime"] button[type=submit]').click()
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True);p=b.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce');errors=[];p.set_default_timeout(120000);p.on('pageerror',lambda e:errors.append(str(e)))
 p.route('https://fonts.googleapis.com/**',lambda r:r.abort());p.route('https://fonts.gstatic.com/**',lambda r:r.abort());p.goto(URL,wait_until='networkidle')
 click(p,'play:ending');g=game(p,'ending');a=ANIME[g['questions'][0]];m=a['ending']
 p.wait_for_function('document.querySelector("audio").duration>24');duration=p.locator('audio').evaluate('(m)=>m.duration');assert duration>1
 if 'audioDuration' in m:assert abs(duration-m['audioDuration'])<1
 assert p.locator('audio').evaluate('(m)=>m.currentTime')==0
 p.locator('#answer').fill('Some unfinished answer');click(p,'hint:1')
 expect(p.locator('.ending-cover img')).to_be_visible();p.wait_for_function('document.querySelector(".ending-cover img").naturalWidth>0');assert p.locator('.ending-cover img').get_attribute('src').startswith('/hints/')
 p.wait_for_function('document.querySelector(".quiz-video").dataset.positioned==="true"')
 position=p.locator('.quiz-video').evaluate('(v)=>v.currentTime/v.duration');assert position<.01,position;assert p.locator('.quiz-video').get_attribute('src').startswith('/hints/');assert abs(p.locator('.quiz-video').evaluate('(v)=>v.duration')-duration)<1
 assert p.locator('.quiz-video').evaluate('(i)=>getComputedStyle(i).filter')=='none'
 assert p.locator('.video-controls').evaluate('(i)=>getComputedStyle(i).filter')=='none'
 expect(p.locator('#answer')).to_have_value('Some unfinished answer')
 click(p,'media-toggle');p.wait_for_function('document.querySelector(".quiz-video").currentTime>0.1');click(p,'media-toggle')
 p.locator('#video-seek').fill('700');p.locator('#video-seek').dispatch_event('input');assert abs(p.locator('.quiz-video').evaluate('(v)=>v.currentTime/v.duration')-.7)<.02
 p.locator('.quiz-video').evaluate('(v)=>v.currentTime=0');p.wait_for_function('document.querySelector(".quiz-video").currentTime>=Number(document.querySelector(".quiz-video").dataset.windowStart)-.02')
 p.locator('.quiz-video').evaluate('(v)=>v.currentTime=v.duration-1');p.wait_for_function('document.querySelector(".quiz-video").currentTime<=Number(document.querySelector(".quiz-video").dataset.windowEnd)')
 p.locator('#video-volume').fill('0.3');p.locator('#video-volume').dispatch_event('input');assert p.locator('.quiz-video').evaluate('(v)=>v.volume')==.3
 for _ in range(2):click(p,'music-mode:audio');click(p,'music-mode:video')
 assert game(p,'ending')['hints']==[1]
 p.screenshot(path=str(ROOT/'qa/full-ending-hint.png'),full_page=True)
 req=urllib.request.Request(URL+'/'+m['video'],headers={'Range':'bytes=100-199'})
 with urllib.request.urlopen(req) as response:assert response.status==206 and len(response.read())==100
 print('PASS: full audio at 0, full blurred ending cover/video, clear controls, seeking and one-time hint cost')
 click(p,'play:opening');p.wait_for_function('document.querySelector("audio").readyState>=1');full=p.locator('audio').evaluate('(a)=>a.duration')
 assert p.locator('audio').evaluate('(a)=>a.currentTime')==0
 click(p,'hint:1');p.wait_for_function('document.querySelector(".quiz-video").dataset.positioned==="true"')
 info=p.locator('.quiz-video').evaluate('(v)=>({duration:v.duration,offset:Number(v.dataset.offset),time:v.currentTime})')
 assert abs(info['duration']-full*.3)<1 and abs(info['offset']-full*.35)<1 and info['time']==0,info
 expect(p.locator('.video-window-note')).to_contain_text('Locked video window')
 expect(p.locator('.ending-cover')).to_have_count(0)
 click(p,'media-toggle');p.wait_for_function('document.querySelector(".quiz-video").currentTime>.1');click(p,'media-toggle')
 print('PASS: actual opening playback, physical 35–65% window, original timestamps, complete audio at zero')
 click(p,'play:character');g=game(p,'character')
 p.locator('#character-0').fill('a');expect(p.locator('#character-0-suggestions [role=option]').first).to_be_visible()
 assert p.locator('#character-0-suggestions small').count()==0
 p.locator('#character-0').fill('')
 p.locator('#anime-0').fill('Shingeki no Kyojin');expect(p.locator('#anime-0-suggestions [role=option]').first).to_contain_text('Attack on Titan')
 expect(p.locator('#anime-0-suggestions [role=option]').first.locator('small')).to_have_text('Shingeki no Kyojin')
 p.locator('#anime-0').fill('')
 for i,id in enumerate(g['questions'][0]):
  a=ANIME[id];c=next(c for c in a['characters'] if c['id']==g['characterRefs'][0][i])
  if i in [0,2]:p.locator(f'#character-{i}').fill(c['name'])
  if i in [1,2]:p.locator(f'#anime-{i}').fill(a['title'])
 p.locator('form[data-form=characters] button[type=submit]').click()
 expect(p.locator('.round-score strong')).to_contain_text(re.compile(r'5[,\s]000'))
 cards=p.locator('.character-item')
 for i,(name_ok,anime_ok) in enumerate([(True,False),(False,True),(True,True),(False,False)]):
  fields=cards.nth(i).locator('.field-result');expect(fields.nth(0)).to_have_class('field-result '+('correct' if name_ok else 'incorrect'));expect(fields.nth(1)).to_have_class('field-result '+('correct' if anime_ok else 'incorrect'))
 p.screenshot(path=str(ROOT/'qa/character-field-scores.png'),full_page=True)
 print('PASS: independent 2,000 name / 500 anime scores and red/green feedback')
 click(p,'play:anidle');target=ANIME[game(p,'anidle')['questions'][0]]
 wrong=[a for a in PACK['anime'] if a['id']!=target['id'] and a['score'] is not None][:3]
 for a in wrong:submit(p,a['title'])
 expect(p.locator('.summary-table-anidle tbody tr')).to_have_count(1)
 p.locator('#answer').fill('unfinished');click(p,'toggle-summary');expect(p.locator('#anidle-summary')).not_to_be_visible();expect(p.locator('#answer')).to_have_value('unfinished')
 p.reload(wait_until='networkidle');click(p,'play:anidle');expect(p.locator('#anidle-summary')).not_to_be_visible();click(p,'toggle-summary')
 for attempt in [13,18,22]:
  click(p,'skip-anidle');assert game(p,'anidle')['attempt']==attempt
  expect(p.locator('.clue-cover img')).to_be_visible()
  if attempt<18:expect(p.locator('.synopsis-clue')).to_contain_text('5 guesses')
  else:expect(p.locator('.synopsis-clue')).to_have_text(target['synopsis'])
  if attempt<22:expect(p.locator('.popular-character-clue')).to_contain_text(str(22-attempt)+' guesses')
  else:expect(p.locator('.popular-character-clue')).to_have_text(target['popularCharacter'])
  p.screenshot(path=str(ROOT/f'qa/anidle-{attempt}.png'),full_page=True)
 submit(p,target['title']);expect(p.locator('.category-score>strong')).to_have_text('500')
 print('PASS: deduction summary, persisted toggle, cover/synopsis/popular-character clues at 13/18/22 and 500-point last guess')
 click(p,'play:screenshot');g=game(p,'screenshot');target=ANIME[g['questions'][0]]
 expect(p.locator('[data-action="hint:3"]')).to_be_disabled();click(p,'hint:1');click(p,'hint:2');click(p,'hint:3')
 expect(p.locator('.hint-title')).to_contain_text('Main title:')
 if target.get('alternativeTitle'):expect(p.locator('.hint-title')).to_contain_text('Japanese title:')
 assert game(p,'screenshot')['hints']==[1,2,3]
 submit(p,target['title']);expect(p.locator('.result-score')).to_contain_text(re.compile(r'2[,\s]500'))
 print('PASS: sequential screenshot clues, masked titles and 2,500 remaining points')
 assert not errors,errors
 b.close();print('ALL REQUESTED BEHAVIOR CHECKS PASSED')
