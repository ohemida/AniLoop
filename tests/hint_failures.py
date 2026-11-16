"""A stale development server must produce one useful error, not two broken players."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
URL=os.environ.get('ANILOOP_URL','http://localhost:8097')
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1100,'height':900})
    page.set_default_timeout(120000)
    page.goto(URL);page.locator('.hero').wait_for()
    entries=json.loads((ROOT/'data/pool.json').read_text())['anime']
    target=next(a for a in entries if (a.get('ending') or {}).get('video','').startswith('assets/media/'))
    page.evaluate('''id=>{const state=JSON.parse(localStorage.getItem('aniloop-state-v1'));state.infinity.games.ending.questions[0]=id;localStorage.setItem('aniloop-state-v1',JSON.stringify(state));}''',target['id'])
    page.route('**/api/hints',lambda route:route.fulfill(status=501,body='Unsupported method'))
    page.reload();page.locator('[data-action="play:ending"]').first.click()
    page.locator('[data-action="hint:1"]').click()
    expect(page.locator('.hint-server-error')).to_have_count(1)
    expect(page.locator('.hint-server-error')).to_contain_text('python3 server.py')
    expect(page.locator('.ending-cover')).not_to_be_visible()
    expect(page.locator('.hint-server-error')).to_contain_text('Continue with full audio')
    expect(page.locator('.video-window-note')).to_have_count(0)
    page.screenshot(path=str(ROOT/'qa/hint-outdated-server.png'),full_page=True)
    for width in [320,390]:
        page.set_viewport_size({'width':width,'height':900})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.unroute('**/api/hints')
    page.reload();page.locator('[data-action="play:ending"]').first.click()
    page.wait_for_function('document.querySelector(".quiz-video").readyState>=2')
    assert page.locator('.quiz-video').get_attribute('src').startswith('/hints/')
    assert page.locator('.ending-cover img').get_attribute('src').startswith('/hints/')
    # A transient processing error can recover without losing the typed answer or charging again.
    page.locator('[data-action="music-mode:audio"]').click()
    page.route('**/api/hints',lambda route:route.fulfill(status=503,content_type='application/json',body=json.dumps({'error':'Install ffmpeg and ffprobe, then restart the server.'})))
    page.reload();page.locator('[data-action="play:ending"]').first.click()
    page.locator('[data-action="music-mode:video"]').click()
    expect(page.locator('.hint-error')).to_have_count(2)
    expect(page.locator('.hint-error').first).to_contain_text('Install ffmpeg')
    page.locator('#answer').fill('Unfinished answer')
    page.unroute('**/api/hints')
    page.locator('.hint-error button').first.click()
    page.wait_for_function('document.querySelector(".quiz-video").readyState>=2')
    expect(page.locator('#answer')).to_have_value('Unfinished answer')
    state=page.evaluate("JSON.parse(localStorage.getItem('aniloop-state-v1'))")
    assert state['infinity']['games']['ending']['hints']==[1]
    expect(page.locator('.hint-error')).to_have_count(0)
    browser.close()
    print('PASS: stale server diagnostics, full-width error, mobile layout, successful hints and retry without losing answers or extra points')
