"""Expand real question pools from public catalogue archives; media loads on demand.
Caches source JSON and checkpoints progress. No synthetic entries or duplicated titles.
"""
from pathlib import Path
from datetime import date,timedelta
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse,urlencode
import json,hashlib,subprocess,time,base64,html,re,threading
ROOT=Path(__file__).resolve().parents[1];CACHE=ROOT/'.tools/source-cache';CACHE.mkdir(parents=True,exist_ok=True)
ORIGIN='https://cms.aniguessr.com';TODAY=date.today();DAYS=365
base=json.loads((ROOT/'data/pool.json').read_text());entries={a['id']:a for a in base['anime']}
media_index=json.loads((ROOT/'data/media-index.json').read_text()) if (ROOT/'data/media-index.json').exists() else {}

def request(url):
 path=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.json')
 if path.exists():return json.loads(path.read_text())
 result=subprocess.run(['curl','--fail','-L','-sS','--retry','1','--max-time','25',url],capture_output=True)
 if result.returncode:raise RuntimeError(result.stderr.decode()[-160:])
 data=json.loads(result.stdout);path.write_text(json.dumps(data));time.sleep(.16);return data

def asset(url,kind='image'):
 if not url:return None
 host=urlparse(url).hostname or ''
 if host not in {'cms.aniguessr.com','medias.aniguessr.com','cdn.myanimelist.net','a.animethemes.moe','v.animethemes.moe','s4.anilist.co'}:return None
 ext=Path(urlparse(url).path).suffix.lower()
 if ext not in {'.jpg','.jpeg','.png','.webp','.mp3','.ogg','.mp4','.webm'}:ext='.jpg' if kind=='image' else '.mp3' if kind=='audio' else '.mp4'
 key=hashlib.sha256(url.encode()).hexdigest()[:32]+ext
 media_index[key]={'url':url,'kind':kind}
 return 'media/'+key

def entry(id,title,aliases=None):
 key='anime-'+str(id)
 if key not in entries:entries[key]={'id':key,'cmsId':str(id),'title':html.unescape(title),'aliases':[],'character':'','characterAliases':[],'characterImage':None,'year':None,'studio':'','source':'','score':None,'genres':[],'tags':[],'secondary':[],'synopsis':'','popularCharacter':'','screenshots':[],'difficulty':{},'opening':None,'ending':None,'cover':None,'characters':[]}
 a=entries[key];a['aliases']=list(dict.fromkeys(a['aliases']+[html.unescape(v) for v in aliases or [] if v]));return a

# Full public metadata catalogue, with ordinary pagination.
all_meta=[]
def catalog(page):return request(ORIGIN+'/wp-json/wp/v2/anime?'+urlencode({'per_page':100,'page':page,'_fields':'id,meta,terms,title'}))
with ThreadPoolExecutor(max_workers=3) as workers:
 for page,items in enumerate(workers.map(catalog,range(1,34)),1):all_meta.extend(items);print('CATALOG',page,len(all_meta),flush=True)
meta={str(a['id']):a for a in all_meta}
unsafe={str(d['id']) for d in all_meta if any(g.lower() in {'hentai','erotica'} for g in d.get('terms',{}).get('genre',[]))}

def daily(job):
 kind,day=job
 try:
  doc=request(f'{ORIGIN}/wp-json/aniguessr/v1/game/{kind}?date={day}')
  raw=doc.get('game_data');rows=json.loads(base64.b64decode(raw)) if isinstance(raw,str) else [];return kind,day,rows if isinstance(rows,list) else []
 except Exception as e:print('SKIP',kind,day,str(e),flush=True);return kind,day,[]

def ingest(kind,rows):
 for r in rows:
  if kind=='characters':
   for c in r.get('characters',[]):
    ids=c.get('anime_id') or []
    if isinstance(ids,dict):ids=list(ids.values())
    if not ids or str(ids[0]) in unsafe:continue
    a=entry(ids[0],c.get('anime_title','').split(' / ')[0],c.get('accepted_titles'))
    if any(v['id']==str(c['id']) for v in a['characters']):continue
    a['characters'].append({'id':str(c['id']),'name':c['name'],'aliases':c.get('accepted_names',[]),'image':asset(c['image']),'difficulty':r.get('difficulty','Medium')})
   continue
  if r.get('nsfw') or str(r['id']) in unsafe:continue
  a=entry(r['id'],r['title'],r.get('accepted_titles'));a['cover']=a['cover'] or asset(r.get('cover'));a['malLink']=r.get('mal_link') or a.get('malLink');a['alternativeTitle']=r.get('title2') or a.get('alternativeTitle','');a['year']=int(r['year']) if str(r.get('year','')).isdigit() else a['year']
  if kind=='screenshots':
   a['difficulty']['screenshot']=r['difficulty']
   original=[]
   for url in r.get('screenshots',[]):original.append(asset(url))
   # Existing downloaded scenes remain usable; each additional archive scene has its own source ID.
   for src in original:
    if src not in a['screenshots']:a['screenshots'].append(src)
  else:
   category='opening' if kind=='music' else 'ending'
   if not a[category]:
    a[category]={'demo':False,'audio':asset(r.get('local_audio') or r.get('audio'),'audio'),'video':asset(r.get('local_video') or r.get('video'),'video'),'fullLength':True,'videoStartFraction':0,'song':r.get('song_title',''),'artist':r.get('artists',''),'difficulty':r['difficulty']}

jobs=[(kind,(TODAY-timedelta(days=i)).strftime('%Y%m%d')) for i in range(DAYS) for kind in ['screenshots','characters','music','endings'] if kind!='endings' or TODAY-timedelta(days=i)>=date(2026,1,26)]
with ThreadPoolExecutor(max_workers=3) as workers:
 for n,(kind,day,rows) in enumerate(workers.map(daily,jobs),1):
  ingest(kind,rows)
  if n%40==0:
   print('ARCHIVE',n,'/',len(jobs),'anime',len(entries),flush=True)
   (ROOT/'.tools/expanded-checkpoint.json').write_text(json.dumps({'anime':list(entries.values()),'mediaIndex':media_index}))

# Include the rest of the catalogue as genuine titles, but do not pretend they have pictures or music.
for d in all_meta:
 if str(d['id']) in unsafe:continue
 m=d.get('meta',{});entry(d['id'],m.get('title') or d['title']['rendered'],(m.get('alt_titles') or []))
for a in entries.values():
 d=meta.get(a['cmsId'])
 if not d:continue
 m=d.get('meta',{});t=d.get('terms',{})
 a['title']=html.unescape(m.get('title') or a['title']);a['aliases']=list(dict.fromkeys(a['aliases']+(m.get('alt_titles') or [])+([m['title_2']] if m.get('title_2') else [])))
 a['alternativeTitle']=m.get('title_2') or a.get('alternativeTitle','');a['cover']=a['cover'] or asset(m.get('cover'));a['year']=int(m['aired_year']) if str(m.get('aired_year','')).isdigit() else a['year'];a['malLink']=m.get('mal_link') or a.get('malLink');a['studio']=' / '.join(t.get('studio',[]));a['source']=' / '.join(t.get('source',[]));a['genres']=t.get('genre',[]);a['tags']=t.get('tags_primary',[]);a['secondary']=t.get('tags_secondary',[]);a['difficulty']['anidle']=m.get('difficulty') or 'Medium'
 if a['characters']:
  c=a['characters'][0];a['character']=c['name'];a['characterAliases']=c['aliases'];a['characterImage']=c['image']
 if a['opening']:a['opening']['videoWindow']={'startFraction':.35,'endFraction':.65}

# Deduplicate downloaded scenes and remote copies of the identical source image.
source_map={r['path']:r['source'] for r in json.loads((ROOT/'data/media-sources.json').read_text())}
for a in entries.values():
 seen=set();clean=[]
 for path in a['screenshots']:
  url=source_map.get(path) or media_index.get(path[6:],{}).get('url') or path
  if url not in seen:seen.add(url);clean.append(path)
 a['screenshots']=clean
expanded=[a for a in entries.values() if a['cmsId'] not in unsafe]
# Bulk AniList metadata: one alias per title in groups of eight, obeying its rate limit.
# score is explicitly AniList's average score / 10 for added records, not a made-up MAL value.
needs=[a for a in expanded if not(a.get('synopsis') and a.get('popularCharacter') and a.get('score') is not None)]
rate_next=0
for offset in range(0,len(needs),25):
 batch=[a for a in needs[offset:offset+25] if re.search(r'/anime/(\d+)',a.get('malLink') or '')]
 if not batch:continue
 query='query {'+' '.join('m%d: Media(idMal: %s,type:ANIME) { description(asHtml:false) averageScore characters(sort:FAVOURITES_DESC,perPage:1) { nodes { name { full } } } }'%(i,re.search(r'/anime/(\d+)',a['malLink']).group(1)) for i,a in enumerate(batch))+'}'
 path=CACHE/('expanded-anilist-'+hashlib.sha256(query.encode()).hexdigest()+'.json')
 try:
  if path.exists():data=json.loads(path.read_text())
  else:
   for retry in range(4):
    time.sleep(max(0,rate_next-time.monotonic()))
    result=subprocess.run(['curl','-L','-sS','--max-time','30','-w','\n%{http_code}','https://graphql.anilist.co','-H','Content-Type: application/json','--data',json.dumps({'query':query})],capture_output=True)
    rate_next=time.monotonic()+2.5
    if result.returncode:raise RuntimeError(result.stderr.decode()[-100:])
    body,status=result.stdout.rsplit(b'\n',1)
    if status==b'429':
     print('RATE LIMIT: waiting before retry',offset,flush=True);time.sleep(55);continue
    data=json.loads(body)
    if not data.get('data'):raise RuntimeError(str(data.get('errors'))[:200])
    path.write_text(json.dumps(data));break
   else:raise RuntimeError('Rate limit remained after retries')
  for i,a in enumerate(batch):
   d=(data.get('data') or {}).get('m'+str(i)) or {};desc=html.unescape(re.sub(r'<[^>]+>',' ',d.get('description') or ''));desc=re.sub(r'\s+',' ',desc).strip();desc=re.split(r'\(Source:|\[Written by',desc)[0].strip()
   if desc:a['synopsis']=desc[:650].rsplit(' ',1)[0]+'…' if len(desc)>650 else desc
   nodes=d.get('characters',{}).get('nodes',[])
   if nodes:a['popularCharacter']=nodes[0]['name']['full']
   if a.get('score') is None and d.get('averageScore') is not None:a['score']=d['averageScore']/10;a['scoreSource']='AniList'
   else:a.setdefault('scoreSource','MyAnimeList')
 except Exception as e:print('METADATA SKIP',offset,str(e),flush=True)
 if offset%80==0:print('CLUES',offset,'/',len(needs),flush=True)

from finalize_pool import finalize
expanded=finalize({'anime':expanded},media_index)['anime']
pack={**base,'key':'expanded-pool-v3','name':'Anime-Pool XL','anime':expanded,'builtAt':TODAY.isoformat(),'mediaMode':'bounded-cache','description':'Großer Katalog aus echten Archivaufgaben; Medien werden beim Spielen geladen und begrenzt lokal zwischengespeichert.'}
# Index is saved first. Atomic writes prevent partially readable application data.
for name,data in [('media-index.json',media_index),('pool.json',pack)]:
 dest=ROOT/'data'/name;temp=dest.with_suffix('.json.tmp');temp.write_text(json.dumps(data,ensure_ascii=False,indent=2));temp.replace(dest)
report={'anime':len(expanded),'screenshotAnime':sum(bool(a['screenshots']) for a in expanded),'screenshots':sum(len(a['screenshots']) for a in expanded),'characters':len({c['id'] for a in expanded for c in a['characters']}),'openingAnime':sum(bool(a['opening']) for a in expanded),'endingAnime':sum(bool(a['ending']) for a in expanded),'anidleAnime':sum(bool(a['cover'] and a['synopsis'] and a['popularCharacter'] and a['score'] is not None and a['studio'] and a['source'] and a['genres']) for a in expanded),'remoteAssets':len(media_index),'archiveDays':DAYS}
(ROOT/'data/pool-report.json').write_text(json.dumps(report,indent=2));print('EXPANDED POOL READY',json.dumps(report),flush=True)
