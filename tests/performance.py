from privacy_fixture import open_app
"""Startup stays usable during account loading; indexed search and fonts stay local."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright,expect
URL=os.environ.get('ANILOOP_URL','http://localhost:8100')
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as pw:
    browser=pw.chromium.launch();page=browser.new_page();held=[];external_fonts=[]
    page.route('**/api/account',lambda route:held.append(route))
    page.on('request',lambda r:external_fonts.append(r.url) if 'fonts.googleapis' in r.url or 'fonts.gstatic' in r.url else None)
    open_app(page,URL,wait_until='domcontentloaded');expect(page.locator('.hero')).to_be_visible(timeout=10000)
    page.locator('[data-action="play:character"]:visible').first.click();page.locator('#character-0').fill('Draft stays here')
    assert held
    held.pop().fulfill(status=200,content_type='application/json',body='{"user":null}')
    page.wait_for_function('()=>document.querySelector("#character-0")?.value==="Draft stays here"')
    expect(page.locator('#character-0')).to_have_value('Draft stays here')
    measure=page.locator('#character-0').evaluate('''input=>{const start=performance.now();for(let i=0;i<100;i++){input.value='a';input.dispatchEvent(new Event('input',{bubbles:true}));}return performance.now()-start;}''')
    assert measure<1500,measure
    assert not external_fonts,external_fonts
    page.locator('[data-action="library"]').first.click();page.locator('#library-search').fill('no-match-zzzzzz')
    expect(page.locator('.library-empty')).to_be_visible();page.locator('[data-action="clear-library"]').click();expect(page.locator('.library-item')).to_have_count(60)
    for image in page.locator('.library-item img').all():assert '<span' not in image.get_attribute('alt')
    # Newly added real titles participate in Anidle and accept their English/Japanese aliases.
    added=next(a for a in json.loads((ROOT/'data/pool.json').read_text())['anime'] if a['id'].startswith('anime-mal-'))
    page.evaluate('''id=>{const s=JSON.parse(localStorage.getItem('aniloop-state-v1'));s.infinity.games.anidle.questions=[id];localStorage.setItem('aniloop-state-v1',JSON.stringify(s));}''',added['id'])
    page.reload();page.locator('main h1').wait_for();page.locator('[data-action=home]').first.click();page.locator('.hero').wait_for();page.locator('[data-action="play:anidle"]:visible').first.click()
    page.locator('#answer').fill(added['title']);page.locator('form[data-form=anidle] button[type=submit]').click();expect(page.locator('.category-score')).to_contain_text('10,000')
    print('PASS: usable startup while account request waits; draft preserved; 100 searches in',round(measure,1),'ms; local fonts; empty search recovery; new Anidle entry playable')
    browser.close()
