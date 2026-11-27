"""Real local HTTP/browser integration with a deterministic mocked Supabase API.
No emails or remote Auth users are created. Uses an isolated temporary SQLite DB.
"""
import json,sys,tempfile,threading
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer
from playwright.sync_api import sync_playwright,expect
from privacy_fixture import open_app
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from server import Handler
from community import Community
from supabase_auth import SupabaseAuth
from test_supabase_auth import FakeSupabase
from test_community import complete_round
from friends import Friends
from rooms import Rooms
from rewards import Rewards
from bugs import BugReports
from hint_media import HintMedia
from media_cache import MediaCache

def click(page,action):page.locator('[data-action="'+action+'"]:visible').first.click()
with tempfile.TemporaryDirectory() as folder:
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT)))
    server.community=Community(ROOT,Path(folder)/'accounts.sqlite3')
    server.friends=Friends(server.community);server.rooms=Rooms(server.community);server.rewards=Rewards(server.community);server.bugs=BugReports(server.community)
    server.media_cache=MediaCache(ROOT);server.hint_media=HintMedia(ROOT,server.media_cache)
    fake=FakeSupabase();server.supabase=SupabaseAuth(server.community,'https://example.supabase.co','sb_publishable_test',request=fake)
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    URL='http://127.0.0.1:'+str(server.server_port)
    try:
      with sync_playwright() as pw:
        browser=pw.chromium.launch();context=browser.new_context();page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        open_app(page,URL,wait_until='networkidle');saved=page.evaluate("localStorage.getItem('aniloop-state-v1')")
        click(page,'account');click(page,'register');expect(page.locator('#account-email')).to_be_visible()
        for width in [320,390,768]:
            page.set_viewport_size({'width':width,'height':1000});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
        page.set_viewport_size({'width':1440,'height':1100})
        page.locator('#account-username').fill('CloudPlayer');page.locator('#account-email').fill('qa@example.test')
        for selector in ['#account-password','#account-confirm']:page.locator(selector).fill('Cloud private password!')
        page.locator('form[data-community-form=register] button[type=submit]').click()
        expect(page.locator('.account-message')).to_contain_text('Check your email')
        with server.community.db() as db:assert db.execute('SELECT count(*) FROM users').fetchone()[0]==0
        page.locator('#account-password').fill('Cloud private password!');page.locator('form[data-community-form=login] button[type=submit]').click()
        expect(page.locator('dialog')).not_to_be_visible();click(page,'account')
        expect(page.locator('main')).to_contain_text('Supabase account · Game data on this AniLoop server')
        cookie=next(c for c in context.cookies() if c['name']=='aniloop_session');assert cookie['httpOnly'] and cookie['sameSite']=='Lax' and cookie['value'].startswith('sb.')
        assert 'access-private' not in page.evaluate('JSON.stringify(localStorage)')
        assert 'refresh-private' not in page.evaluate('JSON.stringify(localStorage)')
        # Backend auth recreation and minor notice revisions must not prompt again.
        page.evaluate("const p=JSON.parse(localStorage.getItem('aniloop-privacy-v1'));p.policyVersion='2026-11-24.2';localStorage.setItem('aniloop-privacy-v1',JSON.stringify(p));")
        choice=page.evaluate("localStorage.getItem('aniloop-privacy-v1')")
        server.supabase=SupabaseAuth(server.community,'https://example.supabase.co','sb_publishable_test',request=fake)
        page.reload(wait_until='networkidle');expect(page.locator('.privacy-entry')).to_have_count(0)
        expect(page.locator('main')).to_contain_text('Supabase account · Game data on this AniLoop server')
        assert page.evaluate("localStorage.getItem('aniloop-privacy-v1')")==choice
        assert next(c for c in context.cookies() if c['name']=='aniloop_session')['value']==cookie['value']

        with page.expect_download() as download:click(page,'export-account')
        exported=json.loads(Path(download.value.path()).read_text(encoding='utf-8'));assert exported['cloud']['profile']['username']=='CloudPlayer'
        assert 'access-private' not in json.dumps(exported)
        # A validated submitted run still uses the trusted Python scoring service.
        result=page.request.post(URL+'/api/scores',data={'round':complete_round(server.community)});assert result.ok,result.text()
        assert result.json()['score']==100000
        board=page.request.get(URL+'/api/leaderboard').json();assert any(e['username']=='CloudPlayer' for e in board['entries'])
        # Existing local identities and multiplayer remain usable alongside cloud login.
        other=browser.new_context();friend=other.new_page();open_app(friend,URL,wait_until='networkidle')
        click(friend,'account');click(friend,'register');click(friend,'auth-provider:local')
        expect(friend.locator('#account-email')).to_have_count(0)
        friend.locator('#account-username').fill('ExistingLocal')
        for selector in ['#account-password','#account-confirm']:friend.locator(selector).fill('Local private password!')
        friend.locator('form[data-community-form=register] button[type=submit]').click();expect(friend.locator('dialog')).not_to_be_visible()
        click(page,'rooms');click(page,'social:create:coop');code=page.locator('.room-code-line code').inner_text()
        click(friend,'rooms');friend.locator('#room-code').fill(code);friend.locator('form[data-social-form=join] button[type=submit]').click()
        expect(page.locator('.room-player')).to_have_count(2,timeout=10000);click(page,'social:start')
        expect(friend.locator('.room-question-heading')).to_contain_text('Screenshots',timeout=10000)
        assert 'qa@example.test' not in friend.request.get(URL+'/api/rooms/view?code='+code).text()
        click(page,'social:leave');click(friend,'social:leave')
        click(page,'account');page.locator('#delete-password').fill('Cloud private password!')
        page.locator('form[data-community-form=delete] input[name=confirm]').check()
        page.locator('form[data-community-form=delete] button[type=submit]').click()
        expect(page.locator('main')).to_contain_text('A name for your score.')
        assert fake.deleted;assert page.evaluate("localStorage.getItem('aniloop-state-v1')")==saved
        assert friend.request.get(URL+'/api/account').json()['user']['username']=='ExistingLocal'
        assert not errors,errors
        context.close();other.close();browser.close()
        print('PASS: Supabase confirmation/login/profile, HttpOnly opaque sessions, no JWT browser storage, cloud export/deletion, trusted scores, mixed local/cloud multiplayer and preserved saves')
    finally:server.shutdown();server.server_close();thread.join()
