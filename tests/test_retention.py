import json,os,sqlite3,tempfile,time,unittest
from datetime import datetime,timezone
from pathlib import Path
from contextlib import closing
from community import Community
from rooms import Rooms
from bugs import BugReports
from retention import Maintenance,DAY,month_deadline
ROOT=Path(__file__).resolve().parents[1]
class RetentionTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name);self.community=Community(ROOT,self.root/'accounts.sqlite3');Rooms(self.community);BugReports(self.community);self.maintenance=Maintenance(self.community)
        with self.community.db() as db:db.execute("INSERT INTO users VALUES(1,'Preserved','hash',0)")
        self.now=int(time.time())
    def tearDown(self):self.maintenance.stop();self.temp.cleanup()
    def test_cleanup_only_expires_transient_data_and_preserves_account_scores(self):
        with self.community.db() as db:
            db.execute("INSERT INTO scores VALUES(1,1,'infinity','seed',0,'{}',0)")
            db.execute('INSERT INTO sessions VALUES(?,?,?)',('old',1,self.now-1));db.execute('INSERT INTO sessions VALUES(?,?,?)',('live',1,self.now+DAY))
            for name,age in [('old',91),('new',89)]:db.execute("INSERT INTO bug_reports VALUES(?, 'title','General','steps','','actual','{}',?)",(name,self.now-age*DAY))
            db.execute("INSERT INTO rooms VALUES('ABC234',1,'party','{}',1,0,?)",(self.now-2*DAY,));db.execute("INSERT INTO room_members VALUES('ABC234',1,0)")
        result=self.maintenance.run(self.now)
        self.assertEqual(result['bug_reports'],1);self.assertEqual(result['sessions'],1);self.assertEqual(result['rooms'],1)
        with self.community.db() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM users').fetchone()[0],1);self.assertEqual(db.execute('SELECT COUNT(*) FROM scores').fetchone()[0],1)
            self.assertEqual(db.execute('SELECT COUNT(*) FROM room_members').fetchone()[0],0);self.assertEqual(db.execute('SELECT id FROM bug_reports').fetchone()[0],'new')
    def test_backup_rotation_scoped_private_and_restorable(self):
        self.maintenance.backups=True;self.maintenance.run(self.now);folder=self.maintenance.directory/'backups';snapshot=next(folder.glob('snapshot-*.sqlite3'))
        self.assertEqual(snapshot.stat().st_mode&0o777,0o600)
        with closing(sqlite3.connect(snapshot)) as db:self.assertEqual(db.execute('SELECT username FROM users').fetchone()[0],'Preserved')
        manual=folder/'my-old-backup.sqlite3';manual.write_text('preserve');outside=self.root/'outside.sqlite3';outside.write_text('preserve');link=folder/'snapshot-2000-01-01.sqlite3';link.symlink_to(outside)
        partial=folder/(snapshot.name+'.qa.part');partial.write_text('unfinished snapshot');os.utime(partial,(0,0));os.utime(snapshot,(self.now-31*DAY,self.now-31*DAY));os.utime(manual,(0,0));self.maintenance.backups=False;self.maintenance.run(self.now)
        self.assertFalse(snapshot.exists());self.assertFalse(partial.exists());self.assertTrue(link.is_symlink());self.assertEqual(outside.read_text(),'preserve');self.assertTrue(manual.exists())
    def test_optional_logs_have_no_request_identifiers_and_expire(self):
        self.maintenance.log_request(200);self.assertFalse(self.maintenance.directory.exists())
        self.maintenance.access_logs=True;self.maintenance.log_request(403);path=next((self.maintenance.directory/'logs').glob('*.jsonl'));data=json.loads(path.read_text())
        self.assertEqual(set(data),{'time','status'});self.assertEqual(data['status'],403);self.assertEqual(path.stat().st_mode&0o777,0o600)
        os.utime(path,(self.now-8*DAY,self.now-8*DAY));self.maintenance.run(self.now);self.assertFalse(path.exists())
    def test_cases_have_calendar_deadlines_and_minimal_retention(self):
        jan=int(datetime(2027,1,31,12,tzinfo=timezone.utc).timestamp());self.assertEqual(datetime.fromtimestamp(month_deadline(jan),timezone.utc).day,28)
        result=self.maintenance.open_case('access','internal-reference',self.now);self.maintenance.close_case(result['id'],self.now)
        self.maintenance.run(self.now+31*DAY)
        with self.community.db() as db:self.assertEqual(db.execute('SELECT reference FROM privacy_cases').fetchone()[0],'')
        self.maintenance.run(self.now+366*DAY)
        with self.community.db() as db:self.assertEqual(db.execute('SELECT COUNT(*) FROM privacy_cases').fetchone()[0],0)
        incident=self.maintenance.open_case('incident','incident-reference',self.now)
        self.assertEqual(int(datetime.fromisoformat(incident['due']).timestamp()),self.now+72*3600)

    def test_databases_in_same_parent_have_isolated_managed_backups(self):
        other=Community(ROOT,self.root/'other.sqlite3')
        with other.db() as db:db.execute("INSERT INTO users VALUES(1,'OtherAccount','hash',0)")
        second=Maintenance(other,backups=True);self.maintenance.backups=True
        self.maintenance.run(self.now);second.run(self.now)
        self.assertNotEqual(self.maintenance.directory,second.directory)
        backup=next((second.directory/'backups').glob('snapshot-*.sqlite3'))
        with closing(sqlite3.connect(backup)) as db:self.assertEqual(db.execute('SELECT username FROM users').fetchone()[0],'OtherAccount')
