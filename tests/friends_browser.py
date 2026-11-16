"""Two browser contexts prove mutual friend requests and submitted daily comparisons."""
from pathlib import Path
from types import SimpleNamespace
from datetime import date
import copy,json,os,sys,uuid
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT));sys.path.insert(0,str(ROOT/'tests'))
from test_community import complete_round
URL=os.environ.get('ANILOOP_URL','http://localhost:8100')
PACK=json.loads((ROOT/'data/pool.json').read_text());ANIME={a['id']:a for a in PACK['anime']}
def click(p,action):p.locator('[data-action="'+action+'"]:visible').first.click()
def open_friends(p):click(p,'friends');expect(p.locator('.friends-loading')).to_have_count(0)
def register(p,username):
    response=p.request.post(URL+'/api/register',data={'username':username,'password':'Friends test password!'});assert response.ok,response.text()
    p.goto(URL);expect(p.locator('.account-entry')).to_contain_text(username);return response.json()['user']
with sync_playwright() as pw:
    browser=pw.chromium.launch();contexts=[browser.new_context(viewport={'width':1440,'height':1100}) for _ in range(2)];host,friend=[c.new_page() for c in contexts];errors=[]
    for p in [host,friend]:p.set_default_timeout(30000);p.on('pageerror',lambda e:errors.append(str(e)))
    host.goto(URL);host.locator('.hero').wait_for();open_friends(host);expect(host.locator('.friends-signin')).to_be_visible()
    a=register(host,'Alice_'+uuid.uuid4().hex[:6]);b=register(friend,'Bob_'+uuid.uuid4().hex[:6]);open_friends(host);open_friends(friend)
    host.locator('#friend-username').fill(b['username']);host.locator('form[data-friends-form=request] button[type=submit]').click()
    expect(host.locator('.friend-request')).to_contain_text(b['username']);click(friend,'friend:refresh')
    expect(friend.locator('[data-action="friend:accept:'+str(a['id'])+'"]').first).to_be_visible();click(friend,'friend:accept:'+str(a['id']))
    click(host,'friend:refresh');expect(host.locator('.friend-score-card')).to_have_count(2);expect(friend.locator('.friend-score-card')).to_have_count(2)
    # Only explicitly submitted, server-recalculated completed rounds are shown.
    fixture=complete_round(SimpleNamespace(catalog=ANIME,pack_key=PACK['key']));fixture.update(mode='daily',seed=date.today().isoformat()+':'+PACK['key'])
    result=host.request.post(URL+'/api/scores',data={'round':fixture});assert result.ok,result.text()
    other=copy.deepcopy(fixture);other['games']['screenshot']['answers'][0]['hints']=[1]
    result=friend.request.post(URL+'/api/scores',data={'round':other});assert result.ok,result.text()
    infinity=copy.deepcopy(fixture);infinity.update(mode='infinity',seed=uuid.uuid4().hex);assert friend.request.post(URL+'/api/scores',data={'round':infinity}).ok
    click(host,'friend:refresh');expect(host.locator('.friend-score-card').first).to_contain_text(a['username']);expect(host.locator('.friend-score-card').first).to_contain_text('100,000')
    bob=host.locator('[data-friend-id="'+str(b['id'])+'"]');expect(bob.locator('.friend-daily-score')).to_contain_text('97,500');expect(bob.locator('.friend-infinity')).to_contain_text('100,000');bob.locator('summary').click();expect(bob.locator('.friend-category-scores')).to_contain_text('27,500');expect(bob.locator('.friend-history')).to_contain_text('97,500')
    host.locator('#toast').evaluate("el=>el.classList.remove('visible')")
    host.screenshot(path=str(ROOT/'qa/friends-daily.png'),full_page=True)
    for width in [1200,1024,768,390,320]:
        host.set_viewport_size({'width':width,'height':1000});assert host.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
    host.screenshot(path=str(ROOT/'qa/friends-mobile.png'),full_page=True)
    host.set_viewport_size({'width':1440,'height':1100});click(host,'friend:remove:'+str(b['id']));expect(host.locator('.friend-score-card')).to_have_count(1);click(friend,'friend:refresh');expect(friend.locator('.friend-score-card')).to_have_count(1)
    # Request cancellation, decline, and a visible validation failure keep the input usable.
    host.locator('#friend-username').fill(b['username']);host.locator('form[data-friends-form=request] button[type=submit]').click();click(host,'friend:cancel:'+str(b['id']));expect(host.locator('.friend-request')).to_have_count(0)
    host.locator('#friend-username').fill(b['username']);host.locator('form[data-friends-form=request] button[type=submit]').click();click(friend,'friend:refresh');click(friend,'friend:decline:'+str(a['id']));click(host,'friend:refresh');expect(host.locator('.friend-request')).to_have_count(0)
    host.locator('#friend-username').fill('no_such_'+uuid.uuid4().hex[:8]);host.locator('form[data-friends-form=request] button[type=submit]').click();expect(host.locator('.friend-form-error')).to_contain_text('No player');expect(host.locator('form[data-friends-form=request] button[type=submit]')).to_be_enabled()
    # Card geometry: one cover, one copy column, no stray text or horizontal overflow.
    click(host,'library');expect(host.locator('.library-item')).to_have_count(60)
    for width in [1440,1200,1024,768,390,320]:
        host.set_viewport_size({'width':width,'height':1000});host.locator('.library-item').first.scroll_into_view_if_needed()
        assert host.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
        assert host.locator('.library-item').first.evaluate('''card=>{const c=card.getBoundingClientRect(),image=card.querySelector('img').getBoundingClientRect(),copy=card.querySelector('.library-item-copy').getBoundingClientRect();return image.right<=copy.left&&copy.right<=c.right&&card.scrollWidth<=card.clientWidth+1;}'''),width
        assert host.locator('.library-item img').count()==60
    host.set_viewport_size({'width':1440,'height':1100});host.locator('.library-item').first.scroll_into_view_if_needed();host.screenshot(path=str(ROOT/'qa/library-boxes.png'),full_page=False)
    for p in [host,friend]:assert p.request.post(URL+'/api/account/delete',data={'password':'Friends test password!'}).ok
    assert not errors,errors
    browser.close();print('PASS: friend request/accept/remove/cancel/decline, daily breakdown and history, Infinity comparison, validated score publishing, responsive friends and boxed library cards')
