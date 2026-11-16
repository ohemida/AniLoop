import unittest,tempfile,json,os,time,sys
from pathlib import Path
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from media_cache import MediaCache
class CacheTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name);(self.root/'data').mkdir()
  self.registry={'image.jpg':{'url':'https://cdn.myanimelist.net/image.jpg','kind':'image'}}
  self.write_registry();self.cache=MediaCache(self.root,max_bytes=1000)
 def tearDown(self):self.temp.cleanup()
 def write_registry(self):(self.root/'data/media-index.json').write_text(json.dumps(self.registry))
 def test_unknown_id_and_traversal_cannot_fetch_network(self):
  with patch('media_cache.subprocess.run') as network:
   for key in ['../secret','missing.jpg','x/y.jpg']:
    with self.assertRaises(FileNotFoundError):self.cache.get(key)
   network.assert_not_called()
 def test_unapproved_host_is_rejected(self):
  self.registry['private.jpg']={'url':'https://127.0.0.1/private','kind':'image'};self.write_registry()
  with self.assertRaises(ValueError):self.cache.get('private.jpg')
 def test_concurrent_requests_share_one_fetch_and_hit_cache(self):
  def download(args,**kw):
   time.sleep(.03);Path(args[-1]).write_bytes(b'\xff\xd8\xff'+b'a'*100);return type('Result',(),{'returncode':0})()
  with patch('media_cache.subprocess.run',side_effect=download) as network:
   with ThreadPoolExecutor(max_workers=4) as workers:paths=list(workers.map(self.cache.get,['image.jpg']*4))
   self.assertEqual(network.call_count,1);self.assertTrue(all(p==paths[0] for p in paths));self.assertTrue(paths[0].exists())
 def test_error_html_is_not_cached(self):
  def download(args,**kw):Path(args[-1]).write_text('<html>error</html>');return type('Result',(),{'returncode':0})()
  with patch('media_cache.subprocess.run',side_effect=download):
   with self.assertRaises(OSError):self.cache.get('image.jpg')
  self.assertFalse((self.cache.directory/'image.jpg').exists())
 def test_budget_evicts_oldest_without_touching_unrelated_files(self):
  outside=self.root/'keep.txt';outside.write_text('keep')
  files=[]
  for i in range(3):
   p=self.cache.directory/f'{i}.jpg';p.write_bytes(b'x'*450);os.utime(p,(i+1,i+1));files.append(p)
  self.cache._evict(files[-1]);self.assertFalse(files[0].exists());self.assertTrue(files[1].exists());self.assertTrue(files[2].exists());self.assertEqual(outside.read_text(),'keep')
if __name__=='__main__':unittest.main()
