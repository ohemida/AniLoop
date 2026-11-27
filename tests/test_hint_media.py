"""Actual encoded hints must stay blurred and trimmed independently of CSS."""
import json, subprocess, tempfile, unittest
from pathlib import Path
from hint_media import HintMedia
from media_cache import MediaCache

class HintMediaTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory();cls.root=Path(cls.temp.name)
        cls.assets=cls.root/'assets/media';cls.assets.mkdir(parents=True)
        subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','testsrc2=size=320x180:rate=12:duration=6','-c:v','libx264','-threads','1',str(cls.assets/'test.mp4')],check=True)
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(cls.assets/'test.mp4'),'-frames:v','1','-update','1',str(cls.assets/'cover.jpg')],check=True)
        cls.hints=HintMedia(cls.root,MediaCache(cls.root))
    @classmethod
    def tearDownClass(cls):cls.temp.cleanup()
    def duration(self,path):
        return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(path)]))
    def test_opening_contains_only_allowed_seconds(self):
        spec={'source':'assets/media/test.mp4','kind':'opening','window':{'startSeconds':2,'endSeconds':4}}
        info=self.hints.create(spec);path=self.hints.get(info['url'].split('/')[-1])
        self.assertAlmostEqual(self.duration(path),2,delta=.15);self.assertEqual(info['offset'],2)
        self.assertNotEqual(path.read_bytes(),(self.assets/'test.mp4').read_bytes())
        before=path.stat().st_mtime_ns;self.assertEqual(info,self.hints.create(spec));self.assertTrue(path.exists())
    def test_ending_retains_full_length(self):
        info=self.hints.create({'source':'assets/media/test.mp4','kind':'ending','window':{'startSeconds':2,'endSeconds':4}})
        self.assertAlmostEqual(self.duration(self.hints.get(info['url'].split('/')[-1])),6,delta=.15)
    def test_cover_is_encoded_derivative(self):
        info=self.hints.create({'source':'assets/media/cover.jpg','kind':'cover'})
        self.assertNotEqual(self.hints.get(info['url'].split('/')[-1]).read_bytes(),(self.assets/'cover.jpg').read_bytes())
    def test_reject_arbitrary_sources_paths_and_windows(self):
        for source in ['assets/media/../../../etc/passwd','https://127.0.0.1/secret','file:///etc/passwd']:
            with self.assertRaises(ValueError):self.hints.create({'source':source,'kind':'cover'})
        with self.assertRaises(ValueError):self.hints.create({'source':'assets/media/test.mp4','kind':'opening','window':{'startSeconds':5,'endSeconds':2}})
        with self.assertRaises(FileNotFoundError):self.hints.get('../test.mp4')
    def test_default_opening_window_and_cache_version(self):
        import hashlib
        spec={'source':'assets/media/test.mp4','kind':'opening'}
        legacy=hashlib.sha256(json.dumps(spec,sort_keys=True).encode()).hexdigest()
        (self.hints.directory/(legacy+'.mp4')).write_bytes(b'old untrimmed video')
        (self.hints.directory/(legacy+'.json')).write_text(json.dumps({'url':'/hints/'+legacy+'.mp4'}),encoding='utf-8')
        info=self.hints.create(spec)
        self.assertNotIn(legacy,info['url'])
        self.assertAlmostEqual(info['offset'],2.1)
        self.assertAlmostEqual(self.duration(self.hints.get(info['url'].split('/')[-1])),1.8,delta=.15)
    def test_element_ids_and_ending_windows_share_derivative(self):
        spec={'source':'assets/media/test.mp4','kind':'ending'}
        first=self.hints.create({**spec,'id':'hint-0'})
        second=self.hints.create({**spec,'id':'hint-1','window':{'startSeconds':2,'endSeconds':4}})
        self.assertEqual(first,second)

    def test_lighter_blur_retains_detail_without_removing_baked_blur(self):
        info=self.hints.create({'source':'assets/media/test.mp4','kind':'ending'})
        derivative=self.hints.get(info['url'].split('/')[-1])
        def edges(path,filters=None):
            args=['ffmpeg','-v','error','-i',str(path)]
            if filters:args+=['-vf',filters]
            raw=subprocess.check_output(args+['-frames:v','1','-pix_fmt','gray','-f','rawvideo','-threads','1','-'])
            return sum(abs(raw[i]-raw[i-1]) for i in range(1,len(raw)) if i%320)/len(raw)
        source=self.assets/'test.mp4'
        self.assertLess(edges(source,'boxblur=6:3'),edges(derivative))
        self.assertLess(edges(derivative),edges(source))
    def test_previous_strong_blur_cache_is_not_reused(self):
        import hashlib
        spec={'source':'assets/media/test.mp4','kind':'ending'}
        old=hashlib.sha256(json.dumps({'version':'opening-window-v3-fast','spec':spec},sort_keys=True).encode()).hexdigest()
        (self.hints.directory/(old+'.mp4')).write_bytes(b'previous strong blur')
        (self.hints.directory/(old+'.json')).write_text(json.dumps({'url':'/hints/'+old+'.mp4'}),encoding='utf-8')
        info=self.hints.create(spec);self.assertNotIn(old,info['url'])
