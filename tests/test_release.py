import json,tempfile,unittest
from pathlib import Path
from scripts.prepare_release import prepare
class ReleaseTests(unittest.TestCase):
    def test_upload_folder_excludes_private_data_and_bundled_media(self):
        with tempfile.TemporaryDirectory() as directory:
            root=prepare(Path(directory)/'upload')
            self.assertTrue((root/'assets/mark.svg').exists());self.assertTrue((root/'Dockerfile').exists())
            self.assertTrue((root/'.github/workflows/checks.yml').exists())
            self.assertFalse((root/'.runtime').exists());self.assertFalse((root/'.tools').exists());self.assertFalse((root/'assets/media').exists())
            pool=(root/'data/pool.json').read_text();self.assertNotIn('assets/media/',pool)
            self.assertEqual(len(json.loads(pool)['anime']),len(json.loads((Path(__file__).resolve().parents[1]/'data/pool.json').read_text())['anime']))
            self.assertTrue((root/'assets/statistics.js').exists());self.assertTrue((root/'compose.private.yml').exists());self.assertTrue((root/'PRIVATE_DEPLOYMENT.md').exists());self.assertTrue((root/'friends.py').exists());self.assertTrue((root/'assets/friends-ui.js').exists());self.assertTrue((root/'catalog.js').exists());self.assertTrue((root/'assets/fonts/fonts.css').exists())
