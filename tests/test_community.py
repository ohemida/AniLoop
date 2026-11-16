import copy,json,tempfile,unittest
from pathlib import Path
from community import Community,APIError
ROOT=Path(__file__).resolve().parents[1]

def complete_round(service):
    anime=list(service.catalog.values());games={}
    for category in ['screenshot','opening','ending']:
        selected=[a for a in anime if a.get(category if category!='screenshot' else 'screenshots')][:3]
        games[category]={'done':True,'questions':[a['id'] for a in selected],'answers':[{'value':a['title'],'hints':[]} for a in selected]}
    chars=[(a,c) for a in anime for c in a.get('characters',[])][:4]
    games['character']={'done':True,'questions':[[a['id'] for a,c in chars] for _ in range(3)],'characterRefs':[[c['id'] for a,c in chars] for _ in range(3)],'answers':[{'entries':[{'characterValue':c['name'],'animeValue':a['title']} for a,c in chars]} for _ in range(3)]}
    target=next(a for a in anime if a.get('synopsis') and a.get('popularCharacter'))
    games['anidle']={'done':True,'questions':[target['id']],'guesses':[{'id':target['id'],'attempt':1}],'answers':[{'value':target['title'],'attempt':1}]}
    return {'mode':'infinity','seed':'test-round','packKey':service.pack_key,'games':games}

class CommunityTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.service=Community(ROOT,Path(self.temp.name)/'accounts.sqlite3')
    def tearDown(self):self.temp.cleanup()
    def register(self,name='Player_One'):
        return self.service.auth({'username':name,'password':'correct horse battery staple'},True,'test')
    def test_passwords_hashed_and_sessions_revoked(self):
        user,token=self.register()
        with self.service.db() as db:
            row=db.execute('SELECT password FROM users').fetchone();self.assertTrue(row[0].startswith('scrypt$'));self.assertNotIn('correct horse',row[0])
            self.assertNotEqual(db.execute('SELECT token FROM sessions').fetchone()[0],token)
        self.assertEqual(self.service.user(token)['username'],user['username']);self.service.logout(token);self.assertIsNone(self.service.user(token))
    def test_sign_in_case_insensitive_duplicate_and_bad_password(self):
        user,_=self.register()
        with self.assertRaises(APIError):self.register('player_one')
        result,token=self.service.auth({'username':'player_one','password':'correct horse battery staple'},False,'test')
        self.assertEqual(result['id'],user['id'])
        with self.assertRaises(APIError):self.service.auth({'username':'player_one','password':'incorrect password'},False,'test')
    def test_password_and_username_validation(self):
        for name,password in [('<script>','long enough password'),('ab','long enough password'),('Valid_Name','short')]:
            with self.assertRaises(APIError):self.service.auth({'username':name,'password':password},True,'test')
    def test_points_recomputed_and_round_deduplicated(self):
        user,_=self.register();run=complete_round(self.service)
        for game in run['games'].values():game['scores']=[999999999]
        result=self.service.submit(user,run);self.assertEqual(result['score'],100000)
        with self.assertRaises(APIError):self.service.submit(user,run)
        board=self.service.leaderboard();self.assertEqual(board['entries'][0]['score'],100000)
    def test_hints_and_raw_character_answers_determine_score(self):
        run=complete_round(self.service)
        run['games']['screenshot']['answers'][0]['hints']=[1,2]
        entry=run['games']['character']['answers'][0]['entries'][0];entry['characterValue']='Wrong';entry['character']=True
        self.assertEqual(self.service.recalculate(run)[2],93000)
    def test_custom_incomplete_and_invalid_hints_rejected(self):
        run=complete_round(self.service)
        for change in ['custom','incomplete','hints']:
            altered=copy.deepcopy(run)
            if change=='custom':altered['packKey']='custom'
            elif change=='incomplete':altered['games']['ending']['done']=False
            else:altered['games']['screenshot']['answers'][0]['hints']=[2]
            with self.assertRaises(APIError):self.service.recalculate(altered)
    def test_best_score_per_player_and_filters(self):
        user,_=self.register();run=complete_round(self.service);self.service.submit(user,run)
        run['seed']='another-round';run['games']['opening']['answers'][0]['value']='Wrong';self.service.submit(user,run)
        row=self.service.leaderboard(period='week')['entries'][0];self.assertEqual(row['score'],100000);self.assertEqual(row['rounds'],2)
        self.assertEqual(self.service.leaderboard('daily')['entries'],[])
    def test_delete_requires_password_and_cascades(self):
        user,token=self.register();self.service.submit(user,complete_round(self.service))
        with self.assertRaises(APIError):self.service.delete(user,'incorrect password')
        self.service.delete(user,'correct horse battery staple');self.assertIsNone(self.service.user(token));self.assertEqual(self.service.leaderboard()['entries'],[])
    def test_throttle(self):
        for _ in range(15):self.service.throttle('ip')
        with self.assertRaises(APIError) as error:self.service.throttle('ip')
        self.assertEqual(error.exception.status,429)
