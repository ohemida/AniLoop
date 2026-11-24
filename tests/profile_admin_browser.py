"""Isolated real HTTP/browser checks for private pictures and admin writes."""
import json,tempfile,threading,sys
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from server import Handler
from community import Community
from rewards import Rewards
from friends import Friends
from rooms import Rooms
from bugs import BugReports
from media_cache import MediaCache
from hint_media import HintMedia
from privacy_fixture import open_app
from test_profile_images import png
from playwright.sync_api import sync_playwright,expect
class Quiet(Handler):
 def log_message(self,*args):pass
with tempfile.TemporaryDirectory() as tmp:
 server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
 server.community=Community(ROOT,Path(tmp)/'accounts.sqlite3');server.rewards=Rewards(server.community);server.friends=Friends(server.community);server.rooms=Rooms(server.community);server.bugs=BugReports(server.community);server.supabase=None
 server.media_cache=MediaCache(ROOT);server.hint_media=HintMedia(ROOT,server.media_cache)
 thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start();url=f'http://127.0.0.1:{server.server_port}'
 try:
  with sync_playwright() as pw:
   browser=pw.chromium.launch(headless=True);ctx=browser.new_context(viewport={'width':1440,'height':1100});other=browser.new_context();page=ctx.new_page();page.set_default_timeout(20000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   def register(context,name):
    r=context.request.post(url+'/api/register',data={'adultConfirmed':True,'username':name,'password':'Profile browser test password!'});assert r.ok,r.text();return r.json()['user']['id']
   admin=register(ctx,'Insider');regular=register(other,'kitsune')
   with server.community.db() as db:db.execute("INSERT INTO account_roles VALUES(?,'admin')",(admin,))
   open_app(page,url,wait_until='networkidle');expect(page.locator('.account-entry')).to_contain_text('Insider')
   page.locator('[data-action="appearance"]:visible').first.click();page.locator('[data-action="appearance:tab:picture"]').click();expect(page.locator('#appearance-profile-file')).to_be_enabled()
   before=page.evaluate("localStorage.getItem('aniloop-state-v1')")
   page.locator('#appearance-profile-file').set_input_files({'name':'profile.png','mimeType':'image/png','buffer':png(16,16)})
   expect(page.locator('.appearance-status')).to_contain_text('Profile picture saved')
   page.wait_for_function('()=>document.querySelector(".appearance-avatar img")?.naturalWidth===256')
   assert other.request.get(url+'/api/account/picture').status==404
   assert other.request.get(url+'/api/admin').status==403
   assert other.request.post(url+'/api/admin/action',data={'action':'set-shards','userId':regular,'shards':1000}).status==403
   page.reload(wait_until='networkidle');expect(page.locator('.own-profile-picture').first).to_be_visible()
   assert page.evaluate("localStorage.getItem('aniloop-state-v1')")==before
   page.locator('[data-action="appearance:tab:picture"]').click()
   for width in [320,768,1440]:
    page.set_viewport_size({'width':width,'height':1100});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
   page.screenshot(path='/tmp/aniloop-profile-editor.png',full_page=True)
   page.locator('[data-action="leaderboard"]:visible').first.click();expect(page.locator('.leaderboard-intro')).to_be_visible();assert page.locator('img[src^="/api/account/picture"]').count()==0
   page.locator('[data-action="account"]:visible').first.click();expect(page.locator('.community-intro .own-profile-picture')).to_be_visible();page.get_by_role('link',name='Admin dashboard').click()
   expect(page.locator('#content')).to_be_visible();row=page.locator('#players tr').filter(has=page.get_by_text('kitsune',exact=True));expect(row).to_contain_text('None')
   row.locator('input').fill('2500');row.get_by_role('button',name='Save').click();expect(page.locator('#status')).to_have_text('Changes saved.')
   with server.community.db() as db:assert db.execute('SELECT shards FROM wallets WHERE user_id=?',(regular,)).fetchone()[0]==2500
   report=server.bugs.submit({'title':'Browser report','steps':'Perform the browser test steps','actual':'The issue appeared during testing'},'test')['id']
   page.reload();expect(page.locator('#reports')).to_contain_text(report);page.on('dialog',lambda dialog:dialog.accept());page.get_by_role('button',name='Delete report').click();expect(page.locator('#status')).to_have_text('Changes saved.');expect(page.locator('#reports')).to_contain_text('No bug reports.')
   for width in [320,768,1440]:
    page.set_viewport_size({'width':width,'height':1100});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
   page.screenshot(path='/tmp/aniloop-admin-write.png',full_page=True)
   page.goto(url+'/#appearance');page.locator('[data-action="appearance:tab:picture"]').click();page.locator('[data-action="appearance:remove-picture"]').click();expect(page.locator('.appearance-status')).to_contain_text('Profile picture removed');assert ctx.request.get(url+'/api/account/picture').status==404
   assert not errors,errors;browser.close()
   print('PASS: real private profile upload/reload/removal/export privacy, no leaderboard pictures, regular-user denial, admin shard edits/report deletion, 320–1440px layouts and unchanged game save.')
 finally:server.shutdown();server.server_close();thread.join()
