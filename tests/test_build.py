import json,tempfile,unittest
from pathlib import Path
from scripts.build import build,MARKER

class BuildTests(unittest.TestCase):
    def prepare(self,out):
        out.mkdir();(out/'index.html').write_text('new build',encoding='utf-8')
    def test_clean_rebuild_removes_stale_generated_files(self):
        with tempfile.TemporaryDirectory() as folder:
            target=Path(folder)/'build'
            def old(out):self.prepare(out);(out/'old.js').write_text('stale',encoding='utf-8')
            build(target,old);build(target,self.prepare)
            self.assertFalse((target/'old.js').exists())
            self.assertFalse(json.loads((target/'BUILD_STATUS.json').read_text(encoding='utf-8'))['githubPagesStandalone'])
    def test_preserves_added_runtime_data_and_modified_output(self):
        for change in ['runtime','edited','nested-marker']:
            with self.subTest(change=change),tempfile.TemporaryDirectory() as folder:
                target=build(Path(folder)/'build',self.prepare)
                if change=='runtime':
                    (target/'.runtime').mkdir();protected=target/'.runtime/accounts.sqlite3';protected.write_bytes(b'private data')
                elif change=='nested-marker':
                    (target/'custom').mkdir();protected=target/'custom'/MARKER;protected.write_text('keep this file',encoding='utf-8')
                else:protected=target/'index.html';protected.write_text('my edits',encoding='utf-8')
                before=protected.read_bytes()
                with self.assertRaises(ValueError):build(target,self.prepare)
                self.assertEqual(protected.read_bytes(),before)
    def test_preserves_unowned_directories_and_symlink_targets(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);target=root/'build';target.mkdir();(target/'custom.txt').write_text('keep',encoding='utf-8')
            with self.assertRaises(ValueError):build(target,self.prepare)
            self.assertEqual((target/'custom.txt').read_text(encoding='utf-8'),'keep')
            target.rename(root/'personal');target.symlink_to(root/'personal',target_is_directory=True)
            with self.assertRaises(ValueError):build(target,self.prepare)
            self.assertEqual((root/'personal/custom.txt').read_text(encoding='utf-8'),'keep')
    def test_failure_keeps_previous_build(self):
        with tempfile.TemporaryDirectory() as folder:
            target=build(Path(folder)/'build',self.prepare)
            def broken(out):out.mkdir();raise ValueError('source failure')
            with self.assertRaises(ValueError):build(target,broken)
            self.assertEqual((target/'index.html').read_text(encoding='utf-8'),'new build')
            self.assertTrue((target/MARKER).is_file())
