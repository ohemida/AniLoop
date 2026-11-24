from privacy_fixture import open_app
"""Real frame purchases against an explicitly designated disposable SQLite database."""
from pathlib import Path
import os,sqlite3,uuid
from playwright.sync_api import sync_playwright,expect
URL=os.environ.get('ANILOOP_URL','http://localhost:8100');database=Path(os.environ['ANILOOP_TEST_DB']).resolve()
assert str(database).startswith('/tmp/') and database.is_file(),'Use only a disposable /tmp database'
with sync_playwright() as pw:
    browser=pw.chromium.launch();page=browser.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    open_app(page,URL);page.locator('.hero').wait_for();name='Frame'+uuid.uuid4().hex[:10]
    response=page.request.post(URL+'/api/register',data={'adultConfirmed':True,'username':name,'password':'Private frame test password!'})
    assert response.ok,response.text()
    with sqlite3.connect(database) as db:
        user=db.execute('SELECT id FROM users WHERE username=?',(name,)).fetchone()[0]
        db.execute("INSERT INTO wallets VALUES(?,2000,'orbit')",(user,));db.execute("INSERT INTO cosmetics VALUES(?,'orbit')",(user,))
    page.reload();page.locator('main h1').wait_for();page.locator('[data-action=home]').first.click();page.locator('.hero').wait_for();page.locator('[data-action=appearance]').first.click()
    expect(page.locator('.appearance-wallet strong')).to_contain_text('2,000')
    page.locator('[data-action="appearance:preview:fern"]').first.click()
    expect(page.locator('.appearance-wallet strong')).to_contain_text('2,000')
    expect(page.locator('.sidebar .avatar')).to_have_class('avatar frame-orbit')
    page.locator('.showcase-action [data-action="appearance:buy:fern"]').click()
    expect(page.locator('.appearance-status')).to_contain_text('unlocked and equipped')
    expect(page.locator('.appearance-wallet strong')).to_contain_text('1,550')
    expect(page.locator('.sidebar .avatar')).to_have_class('avatar frame-fern')
    page.reload();page.locator('main h1').wait_for();page.locator('[data-action=home]').first.click();page.locator('.hero').wait_for();page.locator('[data-action=appearance]').first.click()
    expect(page.locator('.profile-showcase .frame-fern')).to_be_visible()
    page.locator('[data-action="appearance:filter:owned"]').click();expect(page.locator('.frame-item')).to_have_count(3)
    page.locator('[data-action="appearance:equip:orbit"]').first.click();expect(page.locator('.appearance-status')).to_contain_text('Frame equipped')
    expect(page.locator('.appearance-wallet strong')).to_contain_text('1,550')
    assert page.request.post(URL+'/api/rewards/buy',data={'item':'fern'}).status==409
    assert not errors,errors;browser.close();print('PASS: real account preview, purchase, exact shard deduction, reload, owned collection and free re-equip preserve old inventory')
