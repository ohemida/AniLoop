"""Bounded, on-demand cache for entries in the checked-in media registry."""
from pathlib import Path
from urllib.parse import urlparse
import json,threading,subprocess,os
ALLOWED_HOSTS={'cms.aniguessr.com','medias.aniguessr.com','cdn.myanimelist.net','a.animethemes.moe','v.animethemes.moe','s4.anilist.co'}
class MediaCache:
 def __init__(self,root,max_bytes=2*1024**3):
  self.root=Path(root);self.directory=self.root/'.tools/media-cache';self.directory.mkdir(parents=True,exist_ok=True)
  self.max_bytes=max_bytes;self._guard=threading.Lock();self._locks={};self._slots=threading.Semaphore(3);self._index={};self._mtime=None
 def _registry(self):
  path=self.root/'data/media-index.json'
  if not path.exists():return {}
  stamp=path.stat().st_mtime_ns
  if stamp!=self._mtime:
   self._index=json.loads(path.read_text());self._mtime=stamp
  return self._index
 def get(self,key):
  if not key or '/' in key or '\\' in key or '..' in key:raise FileNotFoundError('Invalid media ID')
  with self._guard:
   record=self._registry().get(key)
   if not record:raise FileNotFoundError('Unknown media ID')
   lock=self._locks.setdefault(key,threading.Lock())
  url=record['url'];parsed=urlparse(url)
  if parsed.scheme!='https' or parsed.hostname not in ALLOWED_HOSTS:raise ValueError('Unapproved source')
  path=self.directory/key
  with lock:
   if path.exists() and path.stat().st_size>0:os.utime(path,None);return path
   temp=self.directory/(key+'.part')
   with self._slots:
    result=subprocess.run(['curl','--fail','--location','--silent','--show-error','--retry','1','--max-time','90','--max-filesize','104857600',url,'-o',str(temp)],capture_output=True)
   if result.returncode or not temp.exists() or not temp.stat().st_size:
    temp.unlink(missing_ok=True);raise OSError('Media source could not be loaded')
   # A source error page must not be cached as an image or music file.
   with temp.open('rb') as file:signature=file.read(300).lstrip().lower()
   if signature.startswith((b'<html',b'<!doctype html',b'{"error')):
    temp.unlink(missing_ok=True);raise OSError('Source returned an error page')
   temp.replace(path)
   with self._guard:self._evict(path)
  return path
 def _evict(self,keep):
  files=[p for p in self.directory.iterdir() if p.is_file() and not p.name.endswith('.part')]
  total=sum(p.stat().st_size for p in files)
  for path in sorted(files,key=lambda p:p.stat().st_mtime):
   if total<=self.max_bytes:break
   if path==keep:continue
   try:total-=path.stat().st_size;path.unlink()
   except FileNotFoundError:pass
