"""Guest reports, transparent diagnostics, offline draft/download, and visible theme entry."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];URL=os.environ.get('ANILOOP_URL','http://localhost:8100')
with sync_playwright() as pw:
    browser=pw.chromium.launch();page=browser.new_page(viewport={'width':1440,'height':1100});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(URL);page.locator('.hero').wait_for();saved=page.evaluate("localStorage.getItem('aniloop-state-v1')")
    shortcut=page.get_by_role('button',name='Themes & backgrounds Make AniLoop yours');expect(shortcut).to_be_visible()
    assert shortcut.bounding_box()['y']<200
    shortcut.click();expect(page.locator('.theme-collection')).to_be_visible()
    page.get_by_role('button',name='Report a bug',exact=True).click()
    page.locator('#bug-title').fill('Opening video never starts');page.locator('#bug-category').select_option('Openings')
    page.locator('#bug-steps').fill('Start the opening quiz and unlock the video hint.')
    page.locator('#bug-expected').fill('The video should play.');page.locator('#bug-actual').fill('The loading message stays visible forever.')
    page.locator('.report-diagnostics summary').click();expect(page.locator('#bug-diagnostics')).to_contain_text('viewport')
    page.locator('[name=includeDiagnostics]').uncheck();expect(page.locator('#bug-diagnostics')).to_have_text('{}')
    with page.expect_download() as download:page.get_by_role('button',name='Download copy').click()
    contents=json.loads(Path(download.value.path()).read_text());assert contents['diagnostics']=={} and contents['category']=='Openings'
    page.locator('[data-action=home]').first.click();page.locator('[data-action=bug-report]').click();expect(page.locator('#bug-title')).to_have_value(contents['title'])
    page.route('**/api/bugs',lambda route:route.fulfill(status=503,content_type='application/json',body='{"error":"Server unavailable."}'))
    page.get_by_role('button',name='Send bug report').click();expect(page.locator('[role=alert]')).to_contain_text('draft is still here')
    expect(page.locator('#bug-steps')).to_have_value(contents['steps']);page.unroute('**/api/bugs')
    page.screenshot(path=str(ROOT/'qa/bug-report-desktop.png'),full_page=True)
    for width in [1024,768,390,320]:
        page.set_viewport_size({'width':width,'height':1000});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
        expect(page.locator('.theme-shortcut')).to_be_visible()
    page.screenshot(path=str(ROOT/'qa/bug-report-mobile.png'),full_page=True)
    with page.expect_response('**/api/bugs') as response:page.get_by_role('button',name='Send bug report').click()
    assert response.value.ok;identifier=response.value.json()['id'];expect(page.locator('.report-success')).to_contain_text(identifier)
    assert page.request.get(URL+'/api/bugs').status==404
    assert page.request.post(URL+'/api/bugs',data=contents,headers={'Origin':'https://example.com'}).status==403
    assert page.evaluate("localStorage.getItem('aniloop-state-v1')")==saved
    assert not errors,errors;browser.close();print('PASS: prominent direct theme shortcut, guest report persistence, diagnostics opt-out, download, draft navigation/retry, mobile layout, cross-origin rejection and saves unchanged')
