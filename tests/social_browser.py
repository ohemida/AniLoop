"""Two isolated browsers prove real shared room state. Use a disposable server database."""
from pathlib import Path
from types import SimpleNamespace
import json,os,sys,uuid
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from test_community import complete_round
URL=os.environ.get('ANILOOP_URL','http://localhost:8100');PACK=json.loads((ROOT/'data/pool.json').read_text());ANIME={a['id']:a for a in PACK['anime']}
def click(page,action):page.locator('[data-action="'+action+'"]:visible').first.click()
def snapshot(page,code):return page.request.get(URL+'/api/rooms/view?code='+code).json()['room']
def register(page,name):
    page.goto(URL,wait_until='domcontentloaded');page.locator('.hero').wait_for();click(page,'account');click(page,'register')
    page.locator('#account-username').fill(name);page.locator('#account-password').fill('Shared anime test password!');page.locator('#account-confirm').fill('Shared anime test password!')
    page.locator('form[data-community-form=register] button[type=submit]').click();expect(page.locator('dialog')).not_to_be_visible()
def music_playback(host,friend,code,mode):
    tested=set()
    for _ in range(13):
        room=snapshot(host,code);category=room['category']
        if category in ['opening','ending'] and category not in tested:
            host.wait_for_function('document.querySelector("audio")?.readyState>=1',timeout=180000)
            duration=host.locator('audio').evaluate('(a)=>a.duration')
            assert host.locator('audio').evaluate('(a)=>a.currentTime')==0
            click(host,'hint:1')
            host.wait_for_function('document.querySelector(".quiz-video")?.dataset.positioned==="true"',timeout=180000)
            video=host.locator('.quiz-video')
            data=video.evaluate('(v)=>({duration:v.duration,offset:Number(v.dataset.offset),time:v.currentTime,src:v.currentSrc})')
            assert data['time']<.1 and '/hints/' in data['src'],data
            if category=='opening':
                assert abs(data['duration']-duration*.3)<1,data
                assert abs(data['offset']-duration*.35)<1,data
                expect(host.locator('.video-window-note')).to_contain_text('Locked video window')
            else:
                assert abs(data['duration']-duration)<1 and data['offset']==0,data
                expect(host.locator('.ending-cover img')).to_be_visible()
            click(host,'media-toggle');host.wait_for_function('document.querySelector(".quiz-video").currentTime>.15');click(host,'media-toggle')
            host.locator('#video-seek').fill('900');host.locator('#video-seek').dispatch_event('input')
            assert abs(video.evaluate('(v)=>v.currentTime/v.duration')-.9)<.03
            click(host,'music-mode:audio');assert host.locator('audio').evaluate('(a)=>a.currentTime')==0
            tested.add(category)
            if len(tested)==2:break
        click(host,'giveup');expect(host.locator('dialog')).not_to_be_visible()
        if mode=='party':
            expect(friend.locator('.room-question-heading')).to_contain_text(str(room['questionIndex']+1)+' / 3')
            click(friend,'giveup');expect(friend.locator('dialog')).not_to_be_visible()
        expect(host.locator('[data-action="social:next"]')).to_be_enabled(timeout=10000)
        click(host,'social:next')
        expect(host.locator('.room-question-heading')).to_contain_text('Shared question '+str(room['step']+2)+' /')
        expect(friend.locator('.room-question-heading')).to_contain_text('Shared question '+str(room['step']+2)+' /',timeout=10000)
    assert tested=={'opening','ending'}
    print('PASS:',mode,'full audio, physically clipped opening, full seekable ending, actual playback, direct give up')
with sync_playwright() as pw:
    browser=pw.chromium.launch();host_context=browser.new_context(viewport={'width':1440,'height':1050});friend_context=browser.new_context(viewport={'width':1440,'height':1050})
    host=host_context.new_page();friend=friend_context.new_page();errors=[]
    for page in [host,friend]:page.set_default_timeout(30000);page.on('pageerror',lambda error:errors.append(str(error)))
    register(host,'Host_'+uuid.uuid4().hex[:8]);register(friend,'Mate_'+uuid.uuid4().hex[:8])
    click(host,'rooms');click(host,'social:create:coop');code=host.locator('.room-code-line code').inner_text()
    friend.goto(URL+'/?room='+code,wait_until='domcontentloaded');friend.locator('#room-code').wait_for();expect(friend.locator('#room-code')).to_have_value(code)
    friend.locator('form[data-social-form=join] button[type=submit]').click()
    expect(host.locator('.room-player')).to_have_count(2,timeout=10000);click(host,'social:start')
    expect(friend.locator('.room-question-heading')).to_contain_text('Screenshots',timeout=10000)
    assert host.locator('.question-image').get_attribute('src')==friend.locator('.question-image').get_attribute('src')
    friend.locator('#answer').fill('Keep this unfinished draft')
    click(host,'hint:1');expect(friend.locator('[data-action="view-frame:1"]')).to_be_visible(timeout=10000);expect(friend.locator('#answer')).to_have_value('Keep this unfinished draft')
    expect(friend.locator('.team-hints strong')).to_have_text('7 / 8')
    data=snapshot(friend,code);target=ANIME[data['session']['games']['screenshot']['questions'][0]]
    friend.locator('#answer').fill(target['title']);friend.locator('form[data-form=anime] button[type=submit]').click()
    expect(host.locator('.room-result')).to_contain_text('7,500',timeout=10000);expect(host.locator('#answer')).to_have_count(0)
    click(host,'social:next');expect(friend.locator('.room-question-heading')).to_contain_text('2 / 3',timeout=10000)
    host.screenshot(path=str(ROOT/'qa/coop-room.png'),full_page=True)
    friend.reload(wait_until='domcontentloaded');friend.locator('[data-action="social:resume"]').wait_for();click(friend,'social:resume');expect(friend.locator('.room-question-heading')).to_contain_text('2 / 3')
    music_playback(host,friend,code,'coop')
    click(friend,'social:leave');expect(host.locator('.room-player')).to_have_count(1,timeout=10000);click(host,'social:leave')
    print('PASS: shared co-op questions, hints, score, draft preservation, host advancement, refresh/rejoin and leaving')
    click(host,'social:create:party');code=host.locator('.room-code-line code').inner_text();friend.locator('#room-code').fill(code);friend.locator('form[data-social-form=join] button[type=submit]').click()
    expect(host.locator('.room-player')).to_have_count(2,timeout=10000);click(host,'social:start');friend.locator('#answer').wait_for()
    target=ANIME[snapshot(host,code)['session']['games']['screenshot']['questions'][0]]
    host.locator('#answer').fill(target['title']);host.locator('form[data-form=anime] button[type=submit]').click();expect(host.locator('[data-action="social:next"]')).to_be_disabled()
    expect(friend.locator('#answer')).to_be_visible();click(friend,'giveup')
    expect(host.locator('[data-action="social:next"]')).to_be_enabled(timeout=10000);assert [p['score'] for p in snapshot(host,code)['players']]==[10000,0]
    click(host,'social:next');expect(friend.locator('.room-question-heading')).to_contain_text('2 / 3',timeout=10000)
    music_playback(host,friend,code,'party')
    for width in [320,390,768]:
        friend.set_viewport_size({'width':width,'height':900});assert friend.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
    click(host,'social:leave');expect(friend.locator('.room-player small').first).to_contain_text('Host',timeout=10000);click(friend,'social:leave')
    print('PASS: party individual answers and scores, host waits for all players, host transfer and mobile layouts')
    fixture=complete_round(SimpleNamespace(catalog=ANIME,pack_key=PACK['key']))
    host.evaluate('''fixture=>{const s=JSON.parse(localStorage.getItem('aniloop-state-v1'));s.mode='daily';for(const [key,g] of Object.entries(fixture.games)){Object.assign(s.daily.games[key],g);const count=key==='anidle'?1:3;s.daily.games[key].index=count-1;s.daily.games[key].scores=Array(count).fill(key==='opening'||key==='ending'?5000:10000);}localStorage.setItem('aniloop-state-v1',JSON.stringify(s));}''',fixture)
    host.reload(wait_until='domcontentloaded');host.locator('.completion').wait_for();click(host,'social:claim');expect(host.locator('.reward-claimed')).to_be_visible();expect(host.locator('.streak-ring strong')).to_have_text('1');expect(host.locator('.shard-balance')).to_contain_text('100')
    daily=host.evaluate("JSON.parse(localStorage.getItem('aniloop-state-v1')).daily")
    duplicate=host.request.post(URL+'/api/rewards/claim',data={'round':daily});assert duplicate.status==409
    click(host,'rewards');expect(host.locator('.daily-day.today')).to_have_class('daily-day claimed today');host.screenshot(path=str(ROOT/'qa/daily-reward-claimed.png'),full_page=True)
    for width in [320,390,768]:
        host.set_viewport_size({'width':width,'height':900});assert host.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
    print('PASS: completed-daily reward, persisted streak and shards, duplicate rejection, seven-day view and mobile rewards')
    for page in [host,friend]:
        click(page,'account');page.locator('#delete-password').fill('Shared anime test password!');page.locator('input[name=confirm]').check();page.locator('form[data-community-form=delete] button[type=submit]').click();expect(page.locator('.account-entry')).to_contain_text('Guest player')
    assert not errors,errors
    browser.close();print('ALL SOCIAL BROWSER CHECKS PASSED')
