"""Build a local real-media quiz pool from publicly readable catalogue records.
No authentication, private endpoints or runtime external API dependency.
"""
from pathlib import Path
from datetime import date,timedelta
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse
import json,base64,subprocess,hashlib,time,html,os,shutil
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'.tools/source-cache'
MEDIA=ROOT/'assets/media'
CACHE.mkdir(parents=True,exist_ok=True);MEDIA.mkdir(parents=True,exist_ok=True)
ORIGIN='https://cms.aniguessr.com'

def request(url):
 key=hashlib.sha256(url.encode()).hexdigest();path=CACHE/(key+'.json')
 if path.exists():return json.loads(path.read_text(encoding='utf-8'))
 raw=subprocess.check_output(['curl','--fail','-L','-sS','--retry','2','--max-time','40',url])
 data=json.loads(raw);path.write_text(json.dumps(data),encoding='utf-8');time.sleep(.12);return data

def daily(item):
 mode,day=item
 try:
  d=request(f'{ORIGIN}/wp-json/aniguessr/v1/game/{mode}?date={day}')
  raw=d.get('game_data');return mode,day,json.loads(base64.b64decode(raw)) if isinstance(raw,str) else []
 except Exception as e:print('SKIP',mode,day,str(e),flush=True);return mode,day,[]

rows=[]
jobs=[(mode,(date.today()-timedelta(days=i)).strftime('%Y%m%d')) for i in range(10) for mode in ['screenshots','characters','music','endings']]
with ThreadPoolExecutor(max_workers=3) as pool:
 for mode,day,data in pool.map(daily,jobs):
  rows.append((mode,day,data));print('CATALOG',mode,day,len(data),flush=True)

entries={};source_records=[]
def entry(id,title,aliases=None):
 key='anime-'+str(id)
 if key not in entries:entries[key]={'id':key,'cmsId':str(id),'title':html.unescape(title),'aliases':[], 'character':'','characterAliases':[], 'characterImage':None,'year':None,'studio':'','source':'','score':None,'genres':[],'tags':[],'secondary':[],'synopsis':'','screenshots':[],'difficulty':{},'opening':None,'ending':None,'cover':None,'characters':[]}
 a=entries[key];a['aliases']=list(dict.fromkeys(a['aliases']+[html.unescape(v) for v in (aliases or []) if v]));return a

# Real screenshots from a variety of daily catalogue records.
for mode,day,data in rows:
 for r in data:
  if mode=='characters':
   for c in r.get('characters',[]):
    anime_ids=c.get('anime_id') or []
    if isinstance(anime_ids,dict):anime_ids=list(anime_ids.values())
    if not anime_ids:continue
    title=c.get('anime_title','').split(' / ')[0]
    a=entry(anime_ids[0],title,c.get('accepted_titles'))
    char={'id':str(c['id']),'name':c['name'],'aliases':c.get('accepted_names',[]),'image':c['image'],'difficulty':r.get('difficulty','Medium')}
    if not any(x['id']==char['id'] for x in a['characters']):a['characters'].append(char)
   continue
  if r.get('nsfw'):continue
  a=entry(r['id'],r['title'],r.get('accepted_titles'));a['cover']=r.get('cover');a['year']=int(r['year']) if r.get('year') else None
  if r.get('title2'):a['aliases']=list(dict.fromkeys(a['aliases']+[r['title2']]))
  a['malLink']=r.get('mal_link')
  if mode=='screenshots':
   a['difficulty']['screenshot']=r['difficulty']
   for url in r.get('screenshots',[]):
    if url not in a['screenshots']:a['screenshots'].append(url)
  else:
   kind='opening' if mode=='music' else 'ending'
   if not a[kind]:a[kind]={'demo':False,'audio':r.get('local_audio') or r.get('audio'),'video':r.get('local_video') or r.get('video'),'originalAudio':r.get('audio'),'originalVideo':r.get('video'),'song':r.get('song_title',''),'artist':r.get('artists',''),'difficulty':r['difficulty']}

# Limit downloaded clips to a balanced set, preserving variety without a huge download.
for kind in ['opening','ending']:
 for level in ['Easy','Medium','Hard']:
  selected=[a for a in entries.values() if a.get(kind) and a[kind]['difficulty']==level]
  for a in selected[5:]:a[kind]=None

# At least 4 characters of each tier per task, multiple candidates per tier.
allchars=[]
for a in entries.values():
 for c in a['characters']:allchars.append((a,c))
for level in ['Easy','Medium','Hard']:
 selected=[(a,c) for a,c in allchars if c['difficulty']==level]
 keep={c['id'] for _,c in selected[:20]}
 for a in entries.values():a['characters']=[c for c in a['characters'] if c['difficulty']!=level or c['id'] in keep]
entries={id:a for id,a in entries.items() if a['screenshots'] or a['characters'] or a['opening'] or a['ending']}

def enrich(a):
 try:
  d=request(f'{ORIGIN}/wp-json/wp/v2/anime/{a["cmsId"]}')
  m=d.get('meta',{});terms=d.get('terms',{})
  a['title']=html.unescape(m.get('title') or d.get('title',{}).get('rendered') or a['title'])
  a['aliases']=list(dict.fromkeys(a['aliases']+m.get('alt_titles',[])+([m['title_2']] if m.get('title_2') else [])))
  a['alternativeTitle']=m.get('title_2','');a['cover']=m.get('cover') or a['cover'];a['year']=int(m['aired_year']) if str(m.get('aired_year','')).isdigit() else a['year']
  a['malLink']=m.get('mal_link') or a.get('malLink');a['studio']=' / '.join(terms.get('studio',[]));a['source']=' / '.join(terms.get('source',[]));a['genres']=terms.get('genre',[]);a['tags']=terms.get('tags_primary',[]);a['secondary']=terms.get('tags_secondary',[]);a['difficulty']['anidle']=m.get('difficulty') or 'Medium'
  # This public comparison response includes metadata for the supplied guess,
  # independent of the hidden answer. We retain only the supplied guess's data.
  from urllib.parse import urlencode
  comparison=request(f'{ORIGIN}/wp-json/aniguessr/v1/animdle/?'+urlencode({'answer':a['title'],'round':'1','date':date.today().strftime('%Y%m%d')}))
  md=comparison.get('data',{})
  if md.get('title',{}).get('value')==a['title']:
   try:a['score']=float(md['score']['value'])
   except (KeyError,TypeError,ValueError):pass
  return a
 except Exception as e:print('METADATA',a['title'],str(e),flush=True);return a
with ThreadPoolExecutor(max_workers=3) as pool:
 for a in pool.map(enrich,list(entries.values())):print('META',a['title'],a['score'],flush=True)

manifest=json.loads((ROOT/'data/media-sources.json').read_text(encoding='utf-8')) if (ROOT/'data/media-sources.json').exists() else []
def download(url,ext,clip=False):
 key=hashlib.sha256((url+('full-v1' if clip else '')).encode()).hexdigest()[:24];dest=MEDIA/(key+ext)
 if dest.exists() and dest.stat().st_size>100:return 'assets/media/'+dest.name
 raw=CACHE/(key+'.download')
 subprocess.run(['curl','--fail','-L','-sS','--retry','2','--max-time','70',url,'-o',str(raw)],check=True,capture_output=True)
 if clip:
  cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(raw),'-map_metadata','-1']
  if ext=='.mp3':cmd+=['-vn','-c:a','libmp3lame','-b:a','128k']
  else:cmd+=['-vf','scale=640:-2','-c:v','libx264','-preset','veryfast','-crf','25','-c:a','aac','-b:a','96k','-movflags','+faststart']
  subprocess.run(cmd+[str(dest)],check=True,capture_output=True)
 else:
  if ext=='.jpg':
   subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(raw),'-vf','scale=960:960:force_original_aspect_ratio=decrease','-frames:v','1','-q:v','3',str(dest)],check=True,capture_output=True)
  else:shutil.copyfile(raw,dest)
 raw.unlink(missing_ok=True)
 manifest.append({'path':'assets/media/'+dest.name,'source':url,'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'fullLength':clip})
 return 'assets/media/'+dest.name

def media(a):
 try:
  a['screenshots']=[download(url,'.jpg') for url in a['screenshots'][:9]]
  if a['cover']:a['cover']=download(a['cover'],'.jpg')
  good=[]
  for c in a['characters']:
   try:c['image']=download(c['image'],'.jpg');good.append(c)
   except Exception as e:print('CHAR SKIP',c['name'],str(e),flush=True)
  a['characters']=good
  if good:
   a['character']=good[0]['name'];a['characterAliases']=good[0]['aliases'];a['characterImage']=good[0]['image']
  for kind in ['opening','ending']:
   if a[kind]:
    m=a[kind]
    try:
     m['audio']=download(m['audio'],'.mp3',True)
     m['video']=download(m['video'],'.mp4',True);m['fullLength']=True;m['videoStartFraction']=0
     for kind in ['audio','video']:
      m[kind+'Duration']=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(ROOT/m[kind])]))
    except Exception as e:print('MUSIC SKIP',a['title'],kind,str(e),flush=True);a[kind]=None
  print('MEDIA',a['title'],len(a['screenshots']),len(good),bool(a['opening']),bool(a['ending']),flush=True)
 except Exception as e:print('MEDIA ERROR',a['title'],str(e),flush=True);a['screenshots']=[]
 return a
with ThreadPoolExecutor(max_workers=3) as pool:records=list(pool.map(media,entries.values()))
records=[a for a in records if a['screenshots'] or a['characters'] or a['opening'] or a['ending']]
pack={'version':1,'key':'real-pool-v2','name':'Anime-Pool','demo':False,'builtAt':date.today().isoformat(),'sources':['https://aniguessr.com/database','https://animethemes.moe/','https://myanimelist.net/'],'description':'Echte Anime-Szenen, Figurenbilder und vollständige Opening-/Ending-Sequenzen. Schwierigkeitsstufen aus dem öffentlichen Katalog.','anime':records}
(ROOT/'data/pool.json').write_text(json.dumps(pack,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'data/media-sources.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('POOL READY',len(records),flush=True)
for kind in ['screenshot','character','opening','ending','anidle']:
 for level in ['Easy','Medium','Hard']:
  if kind=='character':count=sum(sum(c['difficulty']==level for c in a['characters']) for a in records)
  elif kind=='screenshot':count=sum(bool(a['screenshots']) and a['difficulty'].get(kind)==level for a in records)
  elif kind=='anidle':count=sum(bool(a['studio']) and bool(a['genres']) and a['difficulty'].get(kind)==level for a in records)
  else:count=sum(bool(a[kind]) and a[kind]['difficulty']==level for a in records)
  print(kind,level,count,flush=True)

subprocess.run(['python3',str(ROOT/'scripts/enrich_anidle.py')],check=True)
