import json,tempfile,unittest
from pathlib import Path
from community import Community
from rooms import Rooms
from rewards import Rewards
from friends import Friends
ROOT=Path(__file__).resolve().parents[1]
class PrivacyTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.community=Community(ROOT,Path(self.temp.name)/'privacy.db');self.rooms=Rooms(self.community);self.rewards=Rewards(self.community);self.friends=Friends(self.community)
        self.user,self.token=self.community.auth({'username':'PrivacyUser','password':'Privacy test password!'},True,'test')
        self.other,_=self.community.auth({'username':'OtherUser','password':'Other privacy password!'},True,'test')
    def tearDown(self):self.temp.cleanup()
    def test_export_excludes_credentials_and_other_players_individual_state(self):
        room=self.rooms.create(self.user,'party')['room'];self.rooms.join(self.other,room['code'])
        self.rooms.action(self.user,room['code'],{'action':'start','revision':self.rooms.get(self.user,room['code'])['room']['revision']})
        with self.community.db() as db:
            state=json.loads(db.execute('SELECT state FROM rooms').fetchone()['state']);state['players'][str(self.other['id'])]['privateTestMarker']='other-private-progress'
            db.execute('UPDATE rooms SET state=?',(json.dumps(state),))
        data=self.community.export(self.user);encoded=json.dumps(data)
        self.assertEqual(data['account']['username'],'PrivacyUser');self.assertTrue(data['rooms'][0]['ownProgress'])
        for secret in ['scrypt$',self.token,'other-private-progress','"password"','"token"']:self.assertNotIn(secret,encoded)
    def test_delete_scrubs_individual_room_json_and_preserves_other_account(self):
        room=self.rooms.create(self.user,'party')['room'];self.rooms.join(self.other,room['code'])
        self.rooms.action(self.user,room['code'],{'action':'start','revision':self.rooms.get(self.user,room['code'])['room']['revision']})
        self.community.delete(self.user,'Privacy test password!')
        self.assertIsNone(self.community.user(self.token))
        with self.community.db() as db:
            state=json.loads(db.execute('SELECT state FROM rooms').fetchone()['state']);self.assertNotIn(str(self.user['id']),state['players']);self.assertIn(str(self.other['id']),state['players'])
            self.assertEqual(db.execute('SELECT COUNT(*) FROM users').fetchone()[0],1)
