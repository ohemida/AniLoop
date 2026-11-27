from privacy_fixture import open_app
"""Policy discovery, registration transparency, authenticated data export and browser safety."""
from pathlib import Path
import json,os,uuid
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];URL=os.environ.get('ANILOOP_URL','http://localhost:8100')
with sync_playwright() as pw:
    browser=pw.chromium.launch();page=browser.new_page(viewport={'width':1440,'height':1100});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    response=open_app(page,URL);page.locator('.hero').wait_for();saved=page.evaluate("localStorage.getItem('aniloop-state-v1')")
    assert "script-src 'self'" in response.headers['content-security-policy'];assert response.headers['referrer-policy']=='no-referrer'
    assert page.request.get(URL+'/api/account/export').status==401
    page.locator('.policy-footer-links [data-action=privacy]').click();expect(page.locator('h1')).to_have_text('Privacy policy')
    expect(page.locator('.policy-copy')).to_contain_text('dailyaniloop@gmail.com');expect(page.locator('.policy-draft')).to_contain_text('Public release is blocked')
    page.locator('.policy-nav [data-action=cookies]').click();expect(page.locator('.policy-table')).to_contain_text('aniloop_session')
    for width in [1440,768,390,320]:
        page.set_viewport_size({'width':width,'height':1100});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
    page.screenshot(path=str(ROOT/'qa/cookies-mobile.png'),full_page=True)
    page.set_viewport_size({'width':1440,'height':1100});open_app(page,URL+'/#legal');expect(page.locator('h1')).to_have_text('Legal & contact')
    page.locator('[data-action=account]').first.click();page.locator('[data-action=register]').first.click()
    expect(page.locator('.account-note')).to_contain_text('No email is collected');expect(page.locator('.account-note [data-action=privacy]')).to_be_visible()
    page.locator('.account-note [data-action=privacy]').click();expect(page.locator('dialog')).not_to_be_visible();expect(page.locator('h1')).to_have_text('Privacy policy')
    page.locator('[data-action=account]').first.click();page.locator('[data-action=register]').first.click()
    name='Privacy'+uuid.uuid4().hex[:8];page.locator('#account-username').fill(name);page.locator('#account-password').fill('A private test password!');page.locator('#account-confirm').fill('A private test password!')
    page.locator('form[data-community-form=register] button[type=submit]').click();expect(page.locator('dialog')).not_to_be_visible()
    page.locator('[data-action=account]').first.click()
    with page.expect_download() as downloaded:page.locator('[data-action=export-account]').click()
    data=json.loads(Path(downloaded.value.path()).read_text(encoding='utf-8'));assert data['account']['username']==name
    assert 'scrypt$' not in json.dumps(data) and '"token"' not in json.dumps(data)
    page.locator('.policy-footer-links [data-action=privacy]').click();page.screenshot(path=str(ROOT/'qa/privacy-desktop.png'),full_page=True)
    assert page.evaluate("localStorage.getItem('aniloop-state-v1')")==saved
    assert not errors,errors;browser.close();print('PASS: policy/contact links, clear draft blocker, storage inventory, 320–1440px layout, registration links, guest auth rejection, real account export, security headers and unchanged saves')
