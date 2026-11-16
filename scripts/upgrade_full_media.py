"""Replace cropped clips with full-length OP/ED source files, preserving question IDs."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json,hashlib,subprocess
ROOT=Path(__file__).resolve().parents[1]
pack=json.loads((ROOT/'data/pool.json').read_text())
manifest=json.loads((ROOT/'data/media-sources.json').read_text())
source={r['path']:r for r in manifest}

def upgrade(job):
 anime,kind=job;m=anime[kind]
 for media,ext in [('audio','.mp3'),('video','.mp4')]:
  old=m[media];record=source.get(old)
  if not record:raise ValueError(f'No documented source: {old}')
  url=record['source'];name=hashlib.sha256((url+'full-v1').encode()).hexdigest()[:24]+ext
  path=ROOT/'assets/media'/name
  if not path.exists():
   temp=ROOT/'.tools'/('full-'+name+'.part')
   subprocess.run(['curl','--fail','-L','-sS','--retry','2','--max-time','90',url,'-o',str(temp)],check=True)
   probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_type','-of','json',str(temp)]))
   assert float(probe['format']['duration'])>24,(anime['title'],media)
   temp.replace(path)
  probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_type','-of','json',str(path)]))
  duration=float(probe['format']['duration']);types={s['codec_type'] for s in probe['streams']}
  assert 'audio' in types and (media!='video' or 'video' in types)
  m[media]='assets/media/'+name;m[media+'Duration']=duration
  manifest.append({'path':m[media],'source':url,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'fullLength':True,'duration':duration})
 m['videoStartFraction']=0;m['fullLength']=True
 print('FULL',anime['title'],kind,round(m['audioDuration'],2),round(m['videoDuration'],2),flush=True)

jobs=[(a,k) for a in pack['anime'] for k in ['opening','ending'] if a[k]]
with ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(upgrade,jobs))
pack['description']='Echte Anime-Szenen, Figurenbilder und vollständige Opening-/Ending-Sequenzen.'
(ROOT/'data/pool.json').write_text(json.dumps(pack,ensure_ascii=False,indent=2))
(ROOT/'data/media-sources.json').write_text(json.dumps(list({r['path']:r for r in manifest}.values()),ensure_ascii=False,indent=2))
print('ALL FULL MEDIA READY',len(jobs),flush=True)
