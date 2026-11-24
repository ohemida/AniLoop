"""Real unseeded first visits: no game/account/media activity before acknowledgment."""
from pathlib import Path
import os,json
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];URL=os.environ.get('ANILOOP_URL','http://localhost:8100')
with sync_playwright() as pw:
    browser=pw.chromium.launch();errors=[]
    for choice in ['all','necessary','decline']:
        context=browser.new_context(viewport={'width':1440,'height':1100});page=context.new_page();requests=[];page.on('request',lambda r:requests.append(r.url));page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(URL);expect(page.locator('.privacy-entry')).to_be_visible()
        for button in page.locator('.privacy-choice-button').all():expect(button).to_be_disabled()
        assert not any('/api/' in u or '/data/pool.json' in u or '/media/' in u for u in requests),requests
        assert page.evaluate("localStorage.getItem('aniloop-state-v1')") is None
        page.locator('.privacy-entry-links [data-action=privacy]').click();expect(page.locator('.policy-copy')).to_contain_text('dailyaniloop@gmail.com')
        for width in [1440,768,390,320]:
            page.set_viewport_size({'width':width,'height':1100});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
        if choice=='necessary':page.screenshot(path=str(ROOT/'qa/privacy-choice-mobile.png'),full_page=True)
        page.set_viewport_size({'width':1440,'height':1100});page.locator('#privacy-acknowledge').check()
        expect(page.locator('[data-action="choose:necessary"]')).to_be_disabled()
        assert not any('/api/' in u or '/data/pool.json' in u or '/media/' in u for u in requests),requests
        page.locator('#adult-confirm').check()
        if choice=='necessary':page.screenshot(path=str(ROOT/'qa/privacy-choice-desktop.png'),full_page=True)
        page.locator('[data-action="choose:'+choice+'"]').click();expect(page.locator('.hero')).to_be_visible();expect(page.locator('.privacy-entry')).to_have_count(0)
        record=page.evaluate("JSON.parse(localStorage.getItem('aniloop-privacy-v1'))");assert record['adultConfirmed'] is True and record['choice']==choice and record['optionalPurposes']==[]
        saved=page.evaluate("localStorage.getItem('aniloop-state-v1')")
        page.reload();expect(page.locator('.hero')).to_be_visible();expect(page.locator('.privacy-entry')).to_have_count(0)
        page.locator('.policy-footer-links [data-action=privacy-settings]').click();expect(page.locator('.privacy-entry')).to_be_visible()
        expect(page.locator('#app')).to_have_attribute('aria-hidden','true')
        page.locator('[data-action="choose:decline"]').click();expect(page.locator('.privacy-entry')).to_have_count(0)
        assert page.evaluate("localStorage.getItem('aniloop-state-v1')")==saved
        assert page.evaluate("JSON.parse(localStorage.getItem('aniloop-privacy-v1')).choice")=='decline'
        # Expired notice must be acknowledged again, without deleting the game save.
        page.evaluate("const p=JSON.parse(localStorage.getItem('aniloop-privacy-v1'));p.savedAt=0;localStorage.setItem('aniloop-privacy-v1',JSON.stringify(p))")
        page.reload();expect(page.locator('.privacy-entry')).to_be_visible();expect(page.locator('#privacy-acknowledge')).not_to_be_checked()
        assert page.evaluate("localStorage.getItem('aniloop-state-v1')")==saved
        context.close()
    assert not errors,errors;browser.close();print('PASS: all three first-visit choices, no pre-ack game/API/media loading, readable policies, equal controls, required acknowledgement, 320–1440px layout, reload/settings/expiry and save preservation')
