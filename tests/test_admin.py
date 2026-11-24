import tempfile,unittest
from pathlib import Path
from community import Community,APIError
from rewards import Rewards
from bugs import BugReports

ROOT=Path(__file__).resolve().parents[1]
class AdminTests(unittest.TestCase):
    def test_explicit_roles_only_revocation_and_no_credentials(self):
        with tempfile.TemporaryDirectory() as tmp:
            service=Community(ROOT,Path(tmp)/'db.sqlite3');Rewards(service);BugReports(service)
            with service.db() as db:
                db.execute("INSERT INTO users VALUES(1,'Insider','private-password-hash',1)")
                db.execute("INSERT INTO users VALUES(2,'Other','another-private-hash',1)")
                db.execute('INSERT INTO wallets(user_id,shards) VALUES(1,1000000)')
            admin={'id':1,'username':'Insider'};other={'id':2,'username':'Other','isAdmin':True}
            for user,code in [(None,401),(admin,403),(other,403)]:
                with self.assertRaises(APIError) as error:service.admin_summary(user)
                self.assertEqual(error.exception.status,code)
            with service.db() as db:db.execute("INSERT INTO account_roles VALUES(1,'admin')")
            self.assertTrue(service.is_admin(admin));self.assertFalse(service.is_admin(other))
            result=service.admin_summary(admin);self.assertEqual(result['accountCount'],2)
            self.assertEqual(next(p for p in result['players'] if p['id']==1)['shards'],1000000)
            self.assertNotIn('private',str(result));self.assertNotIn('password',str(result))
            # A grant is tied to numeric identity and disappears on deletion.
            with service.db() as db:db.execute('DELETE FROM users WHERE id=1')
            self.assertFalse(service.is_admin(admin))
            with self.assertRaises(APIError):service.admin_summary(admin)
    def test_writes_require_current_role_and_bounded_payloads(self):
        with tempfile.TemporaryDirectory() as tmp:
            service=Community(ROOT,Path(tmp)/'db.sqlite3');Rewards(service);BugReports(service)
            with service.db() as db:
                db.executemany('INSERT INTO users VALUES(?,?,?,?)',[(1,'Insider','hash',1),(2,'kitsune','hash',1)])
                db.execute("INSERT INTO account_roles VALUES(1,'admin')")
            admin={'id':1};regular={'id':2,'isAdmin':True};action={'action':'set-shards','userId':2,'shards':1234}
            for actor in [None,regular]:
                with self.assertRaises(APIError):service.admin_change(actor,action)
            service.admin_change(admin,action)
            with service.db() as db:self.assertEqual(db.execute('SELECT shards FROM wallets WHERE user_id=2').fetchone()[0],1234)
            for value in [True,-1,1000000001,1.2,'100']:
                with self.assertRaises(APIError):service.admin_change(admin,{**action,'shards':value})
            with self.assertRaises(APIError):service.admin_change(admin,{'action':'grant-admin','userId':2})
            report=BugReports(service).submit({'title':'Test report','steps':'Steps to reproduce the issue','actual':'Something happened incorrectly'},'test')['id']
            service.admin_change(admin,{'action':'delete-report','reportId':report})
            with service.db() as db:
                self.assertEqual(db.execute('SELECT COUNT(*) FROM bug_reports').fetchone()[0],0)
                db.execute('DELETE FROM account_roles WHERE user_id=1')
            with self.assertRaises(APIError):service.admin_change(admin,action)
