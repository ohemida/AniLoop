import copy,tempfile,unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from datetime import timedelta
from community import Community,APIError
from rooms import Rooms,STEPS
from rewards import Rewards
from test_community import complete_round
ROOT=Path(__file__).resolve().parents[1]
class SocialTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.community=Community(ROOT,Path(self.temp.name)/'social.db');self.rooms=Rooms(self.community);self.rewards=Rewards(self.community)
        with self.community.db() as db:
            for i,name in [(1,'Host'),(2,'Friend'),(3,'Outside')]:db.execute('INSERT INTO users VALUES(?,?,?,0)',(i,name,'test-only'))
        self.host={'id':1,'username':'Host'};self.friend={'id':2,'username':'Friend'};self.outside={'id':3,'username':'Outside'}
    def tearDown(self):self.temp.cleanup()
    def start(self,mode='coop'):
        room=self.rooms.create(self.host,mode)['room'];self.rooms.join(self.friend,room['code']);room=self.rooms.get(self.host,room['code'])['room'];return self.rooms.action(self.host,room['code'],{'action':'start','revision':room['revision']})['room']
    def act(self,room,action,user=None,**extra):return self.rooms.action(user or self.host,room['code'],{'action':action,'revision':room['revision'],**extra})['room']
    def test_room_membership_start_and_host_rules(self):
        room=self.rooms.create(self.host,'party')['room']
        with self.assertRaises(APIError):self.act(room,'start')
        with self.assertRaises(APIError):self.rooms.get(self.outside,room['code'])
        self.rooms.join(self.friend,room['code']);room=self.rooms.get(self.friend,room['code'])['room']
        with self.assertRaises(APIError):self.act(room,'start',self.friend)
        started=self.act(room,'start');self.assertEqual(started['phase'],'playing')
        with self.assertRaises(APIError):self.rooms.join(self.outside,room['code'])
    def test_server_selected_questions_match_levels_and_are_shared(self):
        room=self.start();other=self.rooms.get(self.friend,room['code'])['room'];self.assertEqual(room['session'],other['session'])
        for category in ['screenshot','opening','ending']:
            for anime_id,level in zip(room['session']['games'][category]['questions'],['Easy','Medium','Hard']):
                anime=self.community.catalog[anime_id];difficulty=(anime.get(category) or {}).get('difficulty') if category!='screenshot' else anime['difficulty']['screenshot'];self.assertEqual(difficulty,level)
    def test_coop_shared_answer_and_stale_revision_prevents_double_submission(self):
        room=self.start();target=self.community.catalog[room['session']['games']['screenshot']['questions'][0]]
        answered=self.act(room,'answer',self.friend,value=target['title']);self.assertTrue(answered['ready']);self.assertEqual(answered['session']['games']['screenshot']['scores'],[10000])
        with self.assertRaises(APIError):self.act(room,'giveup')
        advanced=self.act(answered,'next');self.assertEqual(advanced['step'],1)
    def test_party_players_answer_independently_and_wait(self):
        room=self.start('party');target=self.community.catalog[room['session']['games']['screenshot']['questions'][0]]
        room=self.act(room,'answer',value=target['title']);self.assertFalse(room['allReady'])
        with self.assertRaises(APIError):self.act(room,'next')
        guest=self.rooms.get(self.friend,room['code'])['room'];self.assertFalse(guest['ready']);guest=self.act(guest,'giveup',self.friend);self.assertTrue(guest['allReady'])
        self.assertEqual([p['score'] for p in guest['players']],[10000,0])
    def test_independent_party_answers_survive_other_player_revision_changes(self):
        room=self.start('party');guest=self.rooms.get(self.friend,room['code'])['room']
        self.act(room,'giveup')
        result=self.rooms.action(self.friend,room['code'],{'action':'giveup','revision':guest['revision'],'turn':guest['turn']})['room']
        self.assertTrue(result['allReady'])
    def test_coop_eight_hints_and_infinity_gate(self):
        room=self.start()
        with self.assertRaises(APIError):self.act(room,'next-loop')
        for i in range(3):
            for hint in range(1,4):
                if i==2 and hint==3:
                    with self.assertRaises(APIError):self.act(room,'hint',number=hint)
                else:room=self.act(room,'hint',number=hint)
            room=self.act(room,'giveup');room=self.act(room,'next')
        self.assertEqual(room['hintsRemaining'],0)
        for _ in range(10):room=self.act(room,'giveup');room=self.act(room,'next')
        self.assertEqual(room['phase'],'complete');new=self.act(room,'next-loop');self.assertEqual(new['loop'],2);self.assertEqual(new['hintsRemaining'],8)
    def test_simultaneous_team_hints_are_charged_once(self):
        room=self.start()
        def unlock(user):
            try:return self.rooms.action(user,room['code'],{'action':'hint','number':1,'revision':room['revision'],'turn':room['turn']})
            except APIError:return None
        with ThreadPoolExecutor(max_workers=2) as workers:results=list(workers.map(unlock,[self.host,self.friend]))
        self.assertEqual(sum(result is not None for result in results),1)
        final=self.rooms.get(self.host,room['code'])['room'];self.assertEqual(final['hintsRemaining'],7)
    def test_rooms_survive_service_restart_and_deleted_host_is_replaced(self):
        room=self.start();restarted=Rooms(self.community);self.assertEqual(restarted.get(self.friend,room['code'])['room']['session'],room['session'])
        with self.community.db() as db:db.execute('DELETE FROM users WHERE id=1')
        self.assertEqual(restarted.get(self.friend,room['code'])['room']['hostId'],2)
    def test_host_leave_transfers_room_and_last_leave_deletes(self):
        room=self.start();self.act(room,'leave');room=self.rooms.get(self.friend,room['code'])['room'];self.assertEqual(room['hostId'],2)
        self.act(room,'leave',self.friend);self.assertIsNone(self.rooms.current(self.friend)['room'])
    def test_reward_claim_once_and_cannot_reuse_same_daily_next_day(self):
        run=complete_round(self.community);run.update(mode='daily',seed=self.rewards.today().isoformat()+':'+self.community.pack_key)
        result=self.rewards.claim(self.host,run);self.assertEqual(result['earned'],100);self.assertEqual(result['rewards']['streak'],1)
        with self.assertRaises(APIError):self.rewards.claim(self.host,run)
        tomorrow=self.rewards.today()+timedelta(days=1);self.rewards.today=lambda:tomorrow
        with self.assertRaises(APIError):self.rewards.claim(self.host,run)
    def test_concurrent_daily_claims_cannot_duplicate_shards(self):
        run=complete_round(self.community);run.update(mode='daily',seed=self.rewards.today().isoformat()+':'+self.community.pack_key)
        def claim(_):
            try:return self.rewards.claim(self.host,run)
            except APIError:return None
        with ThreadPoolExecutor(max_workers=2) as workers:results=list(workers.map(claim,[1,2]))
        self.assertEqual(sum(result is not None for result in results),1);self.assertEqual(self.rewards.get(self.host)['balance'],100)
    def test_seventh_day_bonus_badges_and_cosmetic_spending(self):
        today=self.rewards.today()
        with self.community.db() as db:
            for n in range(6,0,-1):
                day=(today-timedelta(days=n)).isoformat();db.execute('INSERT INTO daily_claims VALUES(?,?,?,?,?,0)',(1,day,day,100,100000))
            db.execute('INSERT INTO wallets VALUES(1,600,\'classic\')')
        run=complete_round(self.community);run.update(mode='daily',seed=today.isoformat()+':'+self.community.pack_key)
        state=self.rewards.claim(self.host,run);self.assertEqual(state['earned'],150);self.assertEqual(state['rewards']['balance'],750);self.assertEqual(state['rewards']['streak'],7);self.assertTrue(state['rewards']['milestones'][1]['unlocked'])
        wallet=self.rewards.cosmetic(self.host,'orbit')['rewards'];self.assertEqual(wallet['balance'],250);self.assertEqual(wallet['equipped'],'orbit')
        with self.assertRaises(APIError):self.rewards.cosmetic(self.host,'orbit')
        with self.assertRaises(APIError):self.rewards.cosmetic(self.host,'starlit')
        self.assertEqual(self.rewards.cosmetic(self.host,'classic',True)['rewards']['equipped'],'classic')
    def test_new_frames_preserve_old_inventory_and_charge_once(self):
        with self.community.db() as db:
            db.execute("INSERT INTO wallets VALUES(1,3000,'orbit')")
            db.execute("INSERT INTO cosmetics VALUES(1,'orbit')")
        for item,price in [('fern',450),('ink',750),('lunar',1250)]:
            before=self.rewards.get(self.host)['balance']
            wallet=self.rewards.cosmetic(self.host,item)['rewards']
            self.assertEqual(wallet['balance'],before-price);self.assertEqual(wallet['equipped'],item)
            self.assertIn('orbit',wallet['owned'])
            with self.assertRaises(APIError):self.rewards.cosmetic(self.host,item)
            self.assertEqual(self.rewards.get(self.host)['balance'],before-price)
        wallet=self.rewards.cosmetic(self.host,'orbit',True)['rewards']
        self.assertEqual(wallet['equipped'],'orbit');self.assertEqual(wallet['balance'],550)
        self.assertEqual(set(wallet['owned']),{'orbit','fern','ink','lunar'})
        with self.assertRaises(APIError):self.rewards.cosmetic(self.host,'unknown')
    def test_missed_day_resets_current_but_keeps_best_streak(self):
        today=self.rewards.today()
        with self.community.db() as db:
            for n in [6,5,4]:
                day=(today-timedelta(days=n)).isoformat();db.execute('INSERT INTO daily_claims VALUES(?,?,?,?,?,0)',(1,day,day,100,0))
        state=self.rewards.get(self.host);self.assertEqual(state['streak'],0);self.assertEqual(state['bestStreak'],3);self.assertTrue(state['milestones'][0]['unlocked'])
    def test_party_accepts_target_title_when_another_anime_has_same_alias(self):
        room=self.start('party')
        target=self.community.catalog[room['session']['games']['screenshot']['questions'][0]]
        other=copy.deepcopy(next(a for a in self.community.catalog.values() if a['id']!=target['id']))
        other['aliases']=[*other.get('aliases',[]),target['title']]
        self.community.catalog={other['id']:other,**{k:v for k,v in self.community.catalog.items() if k!=other['id']}}
        result=self.act(room,'answer',value=target['title'])
        self.assertEqual(result['session']['games']['screenshot']['scores'],[10000])
