"""Serve/decode added scene variants and retain selected indices after reload."""
from privacy_fixture import open_app
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];URL=os.environ.get('ANILOOP_URL','http://localhost:8100')
pack=json.loads((ROOT/'data/pool.json').read_text());anime={a['id']:a for a in pack['anime']};report=json.loads((ROOT/'data/scene-update.json').read_text())
with sync_playwright() as pw:
    browser=pw.chromium.launch();page=browser.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    open_app(page,URL);page.locator('.hero').wait_for()
    for record in report['scenes'][:2]:
        target=anime[record['animeId']];index=target['screenshots'].index('media/'+record['key'])
        page.evaluate('''value=>{const s=JSON.parse(localStorage.getItem('aniloop-state-v1'));s.mode='infinity';const g=s.infinity.games.screenshot;g.questions[0]=value.id;g.frames[0]=[value.index,0,1];localStorage.setItem('aniloop-state-v1',JSON.stringify(s));}''',{'id':target['id'],'index':index})
        page.reload();page.locator('main h1').wait_for();page.locator('[data-action=home]').first.click();page.locator('.hero').wait_for();page.locator('[data-action="play:screenshot"]:visible').first.click()
        expect(page.locator('.question-image')).to_have_attribute('src','media/'+record['key'])
        page.wait_for_function('()=>document.querySelector(".question-image")?.naturalWidth>120')
        page.reload();page.locator('main h1').wait_for();page.locator('[data-action=home]').first.click();page.locator('.hero').wait_for();page.locator('[data-action="play:screenshot"]:visible').first.click();expect(page.locator('.question-image')).to_have_attribute('src','media/'+record['key'])
    page.locator('[data-action=library]').click();page.locator('#library-search').fill('Maid Sama')
    expect(page.locator('.library-item').first).to_contain_text('7 scenes')
    assert not errors,errors;browser.close();print('PASS: added scene variants serve/decode, selected indices survive reload and library exposes available scene counts')
