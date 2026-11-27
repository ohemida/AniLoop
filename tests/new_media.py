from privacy_fixture import open_app
"""Decode newly sourced covers and play a newly registered opening through the UI."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];URL=os.environ.get('ANILOOP_URL','http://localhost:8100')
pack={a['id']:a for a in json.loads((ROOT/'data/pool.json').read_text(encoding='utf-8'))['anime']};update=json.loads((ROOT/'data/catalog-update.json').read_text(encoding='utf-8'))
with sync_playwright() as pw:
    browser=pw.chromium.launch();page=browser.new_page();page.set_default_timeout(180000)
    open_app(page,URL);page.locator('.hero').wait_for()
    for item in update['added'][:2]+[next(a for a in update['added'] if a['id'].startswith('anime-mal-'))]:
        a=pack[item['id']]
        assert page.evaluate('''async src=>{const image=new Image();image.src=src;await image.decode();return image.naturalWidth>0;}''',a['cover'])
    item=next(a for a in update['addedMusic'] if a['kind']=='opening')
    page.evaluate('''id=>{const s=JSON.parse(localStorage.getItem('aniloop-state-v1'));s.infinity.games.opening.questions[0]=id;localStorage.setItem('aniloop-state-v1',JSON.stringify(s));}''',item['id'])
    page.reload();page.locator('main h1').wait_for();page.locator('[data-action=home]').first.click();page.locator('.hero').wait_for();page.locator('[data-action="play:opening"]:visible').first.click()
    page.locator('audio').evaluate('(a)=>a.play()');page.wait_for_function('()=>document.querySelector("audio").currentTime>.1')
    duration=page.locator('audio').evaluate('(a)=>{a.pause();return a.duration;}')
    page.locator('[data-action="hint:1"]').click();page.wait_for_function('()=>document.querySelector("video")?.dataset.positioned==="true"')
    actual=page.locator('video').evaluate('(v)=>v.duration');assert abs(actual-duration*.3)<1
    page.locator('[data-action="media-toggle"]').click();page.wait_for_function('()=>document.querySelector("video").currentTime>.1')
    page.screenshot(path=str(ROOT/'qa/new-opening.png'),full_page=True)
    print('PASS: new catalog covers decode; new opening audio and physically limited protected video play:',pack[item['id']]['title'])
    browser.close()
