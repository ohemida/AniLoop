from privacy_fixture import open_app
"""Use a disposable ANILOOP_DB on the server when running this test."""
from pathlib import Path
import os,json,sys,uuid
from types import SimpleNamespace
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from test_community import complete_round
URL=os.environ.get('ANILOOP_URL','http://localhost:8100')
PACK=json.loads((ROOT/'data/pool.json').read_text())
with sync_playwright() as pw:
    browser=pw.chromium.launch();page=browser.new_page(viewport={'width':1440,'height':1000});page.set_default_timeout(30000)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    open_app(page,URL);page.locator('.hero').wait_for()
    page.locator('[data-action="leaderboard"]').first.click();page.locator('.leaderboard-empty,.leaderboard-table').wait_for()
    page.locator('[data-action="register"]').click()
    name='QA_'+uuid.uuid4().hex[:10];password='Anime loop test password!'
    page.locator('#account-username').fill(name);page.locator('#account-password').fill(password);page.locator('#account-confirm').fill(password)
    page.locator('form[data-community-form="register"] button[type="submit"]').click()
    expect(page.locator('dialog')).not_to_be_visible();expect(page.locator('.account-entry')).to_contain_text(name)
    cookies=page.context.cookies();session=next(c for c in cookies if c['name']=='aniloop_session');assert session['httpOnly'] and session['sameSite']=='Lax'
    page.reload();page.locator('main h1').wait_for();page.locator('[data-action=home]').first.click();page.locator('.hero').wait_for();expect(page.locator('.account-entry')).to_contain_text(name)
    fixture=complete_round(SimpleNamespace(catalog={a['id']:a for a in PACK['anime']},pack_key=PACK['key']))
    page.evaluate('''fixture=>{const state=JSON.parse(localStorage.getItem('aniloop-state-v1'));for(const [key,game] of Object.entries(fixture.games)){Object.assign(state.infinity.games[key],game);const count=key==='anidle'?1:3;state.infinity.games[key].index=count-1;state.infinity.games[key].scores=Array(count).fill(key==='opening'||key==='ending'?5000:10000);}localStorage.setItem('aniloop-state-v1',JSON.stringify(state));}''',fixture)
    page.reload();page.locator('.completion').wait_for();page.locator('[data-action="submit-score"]').click()
    expect(page.locator('[data-action="submit-score"]')).to_be_disabled()
    page.locator('[data-action="leaderboard"]').first.click();expect(page.locator('.your-rank')).to_contain_text(name);expect(page.locator('.your-rank .ranking-score')).to_contain_text('100,000')
    page.screenshot(path=str(ROOT/'qa/community-leaderboard.png'),full_page=True)
    page.locator('#board-period').select_option('week');expect(page.locator('.your-rank')).to_be_visible()
    page.locator('[data-action="board-mode:daily"]').click();page.locator('.leaderboard-empty').wait_for()
    page.locator('[data-action="account"]').click();page.locator('[data-action="logout"]').click();expect(page.locator('.account-entry')).to_contain_text('Guest player')
    page.locator('[data-action="login"]').click();page.locator('#account-username').fill(name);page.locator('#account-password').fill(password);page.locator('form[data-community-form="login"] button[type="submit"]').click();expect(page.locator('dialog')).not_to_be_visible()
    page.locator('[data-action="account"]').click();page.screenshot(path=str(ROOT/'qa/community-account.png'),full_page=True)
    for width in [320,390,768]:
        page.set_viewport_size({'width':width,'height':900});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
    page.locator('#delete-password').fill(password);page.locator('input[name="confirm"]').check();page.locator('form[data-community-form="delete"] button[type="submit"]').click();expect(page.locator('.account-entry')).to_contain_text('Guest player')
    page.locator('[data-action="leaderboard"]').first.click();page.wait_for_timeout(200);assert name not in page.locator('.leaderboard-panel').inner_text()
    assert not errors,errors
    browser.close();print('PASS: registration, HttpOnly cookie, session persistence, score submission, leaderboard filters, login/logout, responsive profile and account deletion')
