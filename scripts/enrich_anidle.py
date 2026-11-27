"""Fill actual synopses and most-favourited character names through AniList's public API."""
from pathlib import Path
import json,subprocess,re,html,time,hashlib
ROOT=Path(__file__).resolve().parents[1]
pool_path=ROOT/'data/pool.json'
pack=json.loads(pool_path.read_text(encoding='utf-8'))
records=[a for a in pack['anime'] if re.search(r'/anime/(\d+)',a.get('malLink') or '')]
results={}
for start in range(0,len(records),8):
 batch=records[start:start+8]
 query='query {'+' '.join('m%d: Media(idMal: %s, type: ANIME) { description(asHtml: false) characters(sort: FAVOURITES_DESC, perPage: 1) { nodes { name { full } } } }'%(i,re.search(r'/anime/(\d+)',a['malLink']).group(1)) for i,a in enumerate(batch))+'}'
 cache=ROOT/'.tools/source-cache'/('anilist-clues-'+hashlib.sha256(query.encode()).hexdigest()[:24]+'.json')
 if cache.exists():data=json.loads(cache.read_text(encoding='utf-8'))
 else:
  raw=subprocess.check_output(['curl','--fail','-L','-sS','--retry','2','--max-time','30','https://graphql.anilist.co','-H','Content-Type: application/json','--data',json.dumps({'query':query})]);data=json.loads(raw);cache.write_text(json.dumps(data),encoding='utf-8');time.sleep(.7)
 for i,a in enumerate(batch):
  d=(data.get('data') or {}).get('m'+str(i)) or {}
  description=html.unescape(re.sub(r'<[^>]+>',' ',d.get('description') or ''))
  description=re.sub(r'\s+',' ',description).strip();description=re.split(r'\(Source:|\[Written by|<br',description)[0].strip()
  if len(description)>650:description=description[:650].rsplit(' ',1)[0]+'…'
  nodes=d.get('characters',{}).get('nodes',[])
  results[a['id']]={'synopsis':description,'popularCharacter':nodes[0]['name']['full'] if nodes else '', 'clueSource':'https://anilist.co/'}
 print('CLUES',start+len(batch),'/',len(records),flush=True)
# Read again: the full-media builder may have updated the pool concurrently.
pack=json.loads(pool_path.read_text(encoding='utf-8'))
for a in pack['anime']:
 if a['id'] in results:a.update(results[a['id']])
pool_path.write_text(json.dumps(pack,ensure_ascii=False,indent=2),encoding='utf-8')
print('ANIDLE CLUES READY',len(results),flush=True)
