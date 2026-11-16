"""Validate, deduplicate, and accurately count the expanded pool."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
def finalize(pack,index):
 pack['anime']=[a for a in pack['anime'] if str(a.get('cmsId','')).isdigit() and isinstance(a.get('title'),str) and a['title'].strip()]
 sources={r['path']:r['source'] for r in json.loads((ROOT/'data/media-sources.json').read_text())}
 for a in pack['anime']:
  a['characters']=[c for c in a['characters'] if c.get('difficulty') in ['Easy','Medium','Hard'] and c.get('image')]
  seen=set();clean=[]
  for path in a['screenshots']:
   if not path:continue
   source=sources.get(path) or index.get(path[6:],{}).get('url') or path
   if source not in seen:seen.add(source);clean.append(path)
  a['screenshots']=clean
  if a['characters']:
   c=a['characters'][0];a['character']=c['name'];a['characterAliases']=c['aliases'];a['characterImage']=c['image']
  else:a['character']='';a['characterAliases']=[];a['characterImage']=None
  if a['opening']:a['opening'].setdefault('videoWindow',{'startFraction':.35,'endFraction':.65})
 return pack

def report(pack,index):
 a=pack['anime'];return {'anime':len(a),'screenshotAnime':sum(bool(v['screenshots']) for v in a),'screenshots':sum(len(v['screenshots']) for v in a),'characters':len({c['id'] for v in a for c in v['characters']}),'openingAnime':sum(bool(v['opening']) for v in a),'endingAnime':sum(bool(v['ending']) for v in a),'anidleAnime':sum(bool(v['cover'] and v['synopsis'] and v.get('popularCharacter') and v['score'] is not None and v['studio'] and v['source'] and v['genres']) for v in a),'remoteAssets':len(index),'archiveDays':365}
if __name__=='__main__':
 p=ROOT/'data/pool.json';pack=json.loads(p.read_text());index=json.loads((ROOT/'data/media-index.json').read_text());pack=finalize(pack,index);temp=p.with_suffix('.json.tmp');temp.write_text(json.dumps(pack,ensure_ascii=False,indent=2));temp.replace(p);counts=report(pack,index);(ROOT/'data/pool-report.json').write_text(json.dumps(counts,indent=2));print(json.dumps(counts,indent=2))
