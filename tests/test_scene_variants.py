import json,unittest
from pathlib import Path
from scripts.add_scene_variants import canonical
ROOT=Path(__file__).resolve().parents[1]
class SceneVariantTests(unittest.TestCase):
    def test_alternate_endpoint_names_are_normalized_for_deduplication(self):
        import base64
        name='123-Anime/Anime_003.jpg';encoded=base64.b64encode(name.encode()).decode()
        self.assertEqual(canonical('https://cms.aniguessr.com/endpoints/screenshot.php?data='+encoded),'anime_003.jpg')
        self.assertEqual(canonical('https://medias.aniguessr.com/screenshots/'+name),'anime_003.jpg')
    def test_added_scenes_have_verified_provenance_and_existing_playable_entries(self):
        report=json.loads((ROOT/'data/scene-update.json').read_text(encoding='utf-8'));anime={a['id']:a for a in json.loads((ROOT/'data/pool.json').read_text(encoding='utf-8'))['anime']};registry=json.loads((ROOT/'data/media-index.json').read_text(encoding='utf-8'))
        self.assertEqual(report['addedScenes'],len(report['scenes']));self.assertGreaterEqual(report['updatedAnime'],8)
        for entry in report['anime']:
            self.assertGreater(entry['after'],entry['before']);self.assertGreaterEqual(entry['before'],3);self.assertEqual(len(anime[entry['id']]['screenshots']),entry['after'])
        for scene in report['scenes']:
            self.assertGreaterEqual(scene['width'],120);self.assertGreaterEqual(scene['height'],70);self.assertEqual(len(scene['sha256']),64)
            self.assertEqual(registry[scene['key']]['url'],scene['url'])
            # Local builds use the cached copy (media/<key>); the static Pages pool streams the verified source URL.
            shots=anime[scene['animeId']]['screenshots'];self.assertTrue('media/'+scene['key'] in shots or scene['url'] in shots,scene['key'])
