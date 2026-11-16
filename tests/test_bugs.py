import json,tempfile,unittest
from pathlib import Path
from community import Community,APIError
from bugs import BugReports
ROOT=Path(__file__).resolve().parents[1]
class BugReportTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.community=Community(ROOT,Path(self.temp.name)/'bugs.sqlite3');self.bugs=BugReports(self.community)
        self.payload={'title':'Video never starts','category':'Openings','steps':'Start the opening quiz and unlock video.','expected':'Video plays','actual':'The loading screen stays visible.','diagnostics':{'theme':'mauve','password':'must not store'}}
    def tearDown(self):self.temp.cleanup()
    def test_anonymous_report_persists_and_ignores_unapproved_diagnostics(self):
        result=self.bugs.submit(self.payload,'test')
        with self.community.db() as db:row=db.execute('SELECT * FROM bug_reports').fetchone()
        self.assertEqual(row['id'],result['id']);self.assertEqual(json.loads(row['diagnostics']),{'theme':'mauve'})
        BugReports(self.community)
        with self.community.db() as db:self.assertEqual(db.execute('SELECT COUNT(*) FROM bug_reports').fetchone()[0],1)
    def test_validates_fields_and_diagnostics(self):
        for field,value in [('title','bad'),('steps',''),('actual','x'*3001),('category','unknown'),('diagnostics',[]),('diagnostics',{'browser':True})]:
            with self.subTest(field=field,value=str(value)[:30]):
                with self.assertRaises(APIError):self.bugs.submit({**self.payload,field:value},'test')
        with self.community.db() as db:self.assertEqual(db.execute('SELECT COUNT(*) FROM bug_reports').fetchone()[0],0)
    def test_rate_limit_and_report_inbox_are_bounded(self):
        for _ in range(15):self.bugs.submit(self.payload,'test')
        with self.assertRaises(APIError) as error:self.bugs.submit(self.payload,'test')
        self.assertEqual(error.exception.status,429)
        with self.community.db() as db:
            for i in range(985):db.execute("INSERT INTO bug_reports VALUES(?, 'title','General','steps','','actual','{}',0)",(str(i),))
        with self.assertRaises(APIError) as error:self.bugs.submit(self.payload,'another')
        self.assertEqual(error.exception.status,503)
