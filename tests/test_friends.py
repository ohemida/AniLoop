import copy,json,tempfile,unittest
from pathlib import Path
from datetime import date,timedelta
from concurrent.futures import ThreadPoolExecutor
from community import Community,APIError
from friends import Friends
ROOT=Path(__file__).resolve().parents[1]
class FriendsTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.community=Community(ROOT,Path(self.temp.name)/'friends.sqlite3');self.friends=Friends(self.community)
        with self.community.db() as db:
            for i,name in [(1,'Alice'),(2,'Bob'),(3,'Carol')]:db.execute('INSERT INTO users VALUES(?,?,?,0)',(i,name,'unused'))
        self.alice={'id':1,'username':'Alice'};self.bob={'id':2,'username':'Bob'};self.carol={'id':3,'username':'Carol'}
    def tearDown(self):self.temp.cleanup()
    def request(self):self.friends.change(self.alice,'request',{'username':'bOB'})
    def accept(self):self.request();self.friends.change(self.bob,'accept',{'userId':1})
    def test_mutual_request_accept_remove_and_no_duplicate(self):
        self.request();self.assertEqual(self.friends.view(self.bob)['incoming'][0]['username'],'Alice');self.assertEqual(self.friends.view(self.alice)['friendCount'],0)
        with self.assertRaises(APIError):self.request()
        with self.assertRaises(APIError):self.friends.change(self.alice,'accept',{'userId':2})
        self.friends.change(self.bob,'accept',{'userId':1})
        self.assertEqual(self.friends.view(self.alice)['friendCount'],1);self.assertEqual(self.friends.view(self.bob)['friendCount'],1)
        self.friends.change(self.alice,'remove',{'userId':2});self.assertEqual(self.friends.view(self.bob)['friendCount'],0)
    def test_decline_cancel_and_outsider_cannot_accept(self):
        self.request()
        with self.assertRaises(APIError):self.friends.change(self.carol,'accept',{'userId':1})
        with self.assertRaises(APIError):self.friends.change(self.alice,'decline',{'userId':2})
        self.friends.change(self.alice,'cancel',{'userId':2});self.assertEqual(self.friends.view(self.bob)['incoming'],[])
        self.request();self.friends.change(self.bob,'decline',{'userId':1});self.assertEqual(self.friends.view(self.alice)['outgoing'],[])
    def test_invalid_names_ids_dates_and_self_requests(self):
        for name in ['Alice','missing_player','bad name',None]:
            with self.assertRaises(APIError):self.friends.change(self.alice,'request',{'username':name})
        for other in [True,'2',None,-1]:
            with self.assertRaises(APIError):self.friends.change(self.alice,'accept',{'userId':other})
        for day in ['2026-99-99','20261116','not-a-date','2000-01-01']:
            with self.assertRaises(APIError):self.friends.view(self.alice,day)
    def test_only_accepted_friends_submitted_results_and_zero_scores(self):
        today=date.today().isoformat();yesterday=(date.today()-timedelta(days=1)).isoformat()
        with self.community.db() as db:
            for uid in [1,2,3]:
                db.execute("INSERT INTO scores(user_id,mode,seed,score,breakdown,created) VALUES(?,'daily',?,0,?,0)",(uid,today,json.dumps({'opening':0})))
                db.execute("INSERT INTO scores(user_id,mode,seed,score,breakdown,created) VALUES(?,'daily',?,75000,'{}',0)",(uid,yesterday))
                db.execute("INSERT INTO scores(user_id,mode,seed,score,breakdown,created) VALUES(?,'infinity','test',90000,'{}',0)",(uid,))
        self.request();self.assertEqual(len(self.friends.view(self.alice)['players']),1)
        self.friends.change(self.bob,'accept',{'userId':1});data=self.friends.view(self.alice)
        self.assertEqual({p['username'] for p in data['players']},{'Alice','Bob'})
        bob=next(p for p in data['players'] if p['username']=='Bob');self.assertEqual(bob['dailyScore'],0);self.assertEqual(bob['bestInfinity'],90000);self.assertEqual(bob['history'][-2]['score'],75000)
        self.assertIsNone(bob['history'][0]['score']);self.assertNotIn('password',json.dumps(data))
    def test_requests_survive_restart_and_account_deletion_cascades(self):
        self.accept();restarted=Friends(Community(ROOT,self.community.path));self.assertEqual(restarted.view(self.bob)['friendCount'],1)
        with self.community.db() as db:db.execute('DELETE FROM users WHERE id=1')
        self.assertEqual(restarted.view(self.bob)['friendCount'],0)
    def test_concurrent_requests_have_single_pending_pair(self):
        def request():
            try:self.request();return 'ok'
            except APIError:return 'duplicate'
        with ThreadPoolExecutor(max_workers=2) as executor:self.assertEqual(sorted(executor.map(lambda _:request(),range(2))),['duplicate','ok'])
        self.assertEqual(len(self.friends.view(self.alice)['outgoing']),1)
