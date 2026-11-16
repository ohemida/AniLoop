"""Isolated browser appearance, storage preservation and responsive layout checks."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];URL=os.environ.get('ANILOOP_URL','http://localhost:8100')
with sync_playwright() as pw:
    browser=pw.chromium.launch();page=browser.new_page(viewport={'width':1440,'height':1100});errors=[];posts=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:posts.append(r.url) if r.method=='POST' else None)
    page.goto(URL);page.locator('.hero').wait_for();saved=page.evaluate("localStorage.getItem('aniloop-state-v1')")
    page.locator('[data-action=appearance]').first.click();expect(page.locator('.frame-item')).to_have_count(7)
    page.locator('[data-action="appearance:preview:fern"]').first.click();expect(page.locator('.profile-showcase .frame-fern')).to_be_visible()
    page.screenshot(path=str(ROOT/'qa/appearance-desktop.png'),full_page=True)
    for width in [1200,1024,768,390,320]:
        page.set_viewport_size({'width':width,'height':1000});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
    page.screenshot(path=str(ROOT/'qa/appearance-mobile.png'),full_page=True)
    page.set_viewport_size({'width':1440,'height':1100});page.locator('[data-action="appearance:tab:themes"]').click()
    page.locator('[data-action="appearance:theme:forest"]').click();expect(page.locator('html')).to_have_attribute('data-theme','forest')
    page.reload();page.locator('.hero').wait_for();expect(page.locator('html')).to_have_attribute('data-theme','forest')
    page.locator('[data-action=appearance]').first.click();page.locator('[data-action="appearance:tab:backgrounds"]').click()
    page.locator('[data-action="appearance:background:grove"]').click();expect(page.locator('html')).to_have_attribute('data-background','grove')
    assert page.locator('.backdrop-none').evaluate("el=>getComputedStyle(el).getPropertyValue('--app-backdrop').trim()")=='none'
    image=page.evaluate("""()=>{const c=document.createElement('canvas');c.width=2200;c.height=1000;const x=c.getContext('2d');x.fillStyle='#789080';x.fillRect(0,0,2200,1000);return c.toDataURL('image/png').split(',')[1]}""")
    import base64
    page.locator('#appearance-background-file').set_input_files({'name':'my-background.png','mimeType':'image/png','buffer':base64.b64decode(image)})
    expect(page.locator('html')).to_have_attribute('data-background','custom');expect(page.locator('.appearance-status')).to_contain_text('saved on this device')
    assert 'blob:' in page.evaluate("document.documentElement.style.getPropertyValue('--custom-background')")
    page.locator('#appearance-position').select_option('top');page.locator('#appearance-in-game').check()
    page.locator('#appearance-dim').fill('45');page.locator('#appearance-dim').dispatch_event('change')
    prefs=page.evaluate("JSON.parse(localStorage.getItem('aniloop-appearance-v1'))");assert prefs=={'theme':'forest','background':'custom','dim':45,'inGame':True,'position':'top'}
    page.reload();page.locator('.hero').wait_for();expect(page.locator('html')).to_have_attribute('data-background','custom')
    page.locator('[data-action=appearance]').first.click();page.locator('[data-action="appearance:tab:backgrounds"]').click()
    page.locator('#appearance-background-file').set_input_files({'name':'invalid.png','mimeType':'image/png','buffer':b'not an image'})
    expect(page.locator('[role=alert]')).to_contain_text('could not be opened');expect(page.locator('html')).to_have_attribute('data-background','custom')
    page.screenshot(path=str(ROOT/'qa/appearance-background.png'),full_page=True)
    page.locator('[data-action="appearance:reset"]').click();expect(page.locator('html')).to_have_attribute('data-theme','mauve');expect(page.locator('html')).to_have_attribute('data-background','none')
    expect(page.locator('[data-action="appearance:background:custom"]')).to_have_count(1)
    page.locator('[data-action="appearance:remove-upload"]').click();expect(page.locator('[data-action="appearance:background:custom"]')).to_have_count(0)
    assert page.evaluate("localStorage.getItem('aniloop-state-v1')")==saved
    assert not posts,posts
    page.locator('[data-action="play:screenshot"]').first.click();expect(page.locator('html')).to_have_attribute('data-quiz-active','true')
    assert page.evaluate("getComputedStyle(document.body,'::before').backgroundImage")=='none'
    assert not errors,errors;browser.close();print('PASS: frame previews, 320–1440px layout, themes, custom upload/reload/rejection/removal, preferences, quiz visibility and save preservation; no uploads to server')
