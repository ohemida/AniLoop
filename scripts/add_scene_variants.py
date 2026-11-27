"""Append verified alternate screenshots for existing playable anime; never reset IDs/saves."""
from pathlib import Path
from datetime import date,timedelta
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit,parse_qs
import argparse,base64,hashlib,json,subprocess,tempfile
ROOT=Path(__file__).resolve().parents[1];ORIGIN='https://cms.aniguessr.com'
def canonical(url):
    parts=urlsplit(url)
    try:
        encoded=parse_qs(parts.query).get('data',[None])[0]
        name=base64.b64decode(encoded).decode() if encoded else parts.path
        return Path(name).name.lower()
    except (ValueError,UnicodeError):return url

def update(days=60,limit=120):
    pack=json.loads((ROOT/'data/pool.json').read_text(encoding='utf-8'));before=json.loads(json.dumps(pack));registry=json.loads((ROOT/'data/media-index.json').read_text(encoding='utf-8'));local={r['path']:r['source'] for r in json.loads((ROOT/'data/media-sources.json').read_text(encoding='utf-8'))}
    entries={str(a.get('cmsId')):a for a in pack['anime'] if a.get('screenshots')};seen={a['id']:{canonical(local.get(src) or registry.get(src.removeprefix('media/'),{}).get('url') or src) for src in a['screenshots']} for a in entries.values()}
    cache=ROOT/'.tools/source-cache'/('scenes-'+date.today().isoformat());cache.mkdir(parents=True,exist_ok=True)
    def daily(offset):
        day=(date.today()-timedelta(days=offset)).strftime('%Y%m%d');url=ORIGIN+'/wp-json/aniguessr/v1/game/screenshots?date='+day;path=cache/(day+'.json')
        try:
            raw=path.read_bytes() if path.exists() else subprocess.check_output(['curl','--fail','-sS','-L','--max-time','20',url],stderr=subprocess.DEVNULL)
            data=json.loads(raw);rows=json.loads(base64.b64decode(data['game_data']));path.write_bytes(raw);return url,rows
        except (subprocess.CalledProcessError,ValueError,KeyError):return url,[]
    candidates=[]
    with ThreadPoolExecutor(max_workers=3) as workers:
        for provenance,rows in workers.map(daily,range(days)):
            for row in rows:
                anime=entries.get(str(row.get('id')))
                if not anime or row.get('nsfw'):continue
                for url in row.get('screenshots',[]):
                    if urlsplit(url).hostname not in {'cms.aniguessr.com','medias.aniguessr.com'}:continue
                    identity=canonical(url)
                    if identity in seen[anime['id']]:continue
                    seen[anime['id']].add(identity);candidates.append((anime['id'],url,provenance))
    print('Alternate scene candidates:',len(candidates),flush=True)
    def verify(item):
        anime_id,url,provenance=item
        try:
            raw=subprocess.check_output(['curl','--fail','-L','-sS','--max-time','20','--max-filesize','8388608',url],stderr=subprocess.DEVNULL)
            if not (raw.startswith(b'\xff\xd8\xff') or raw.startswith(b'\x89PNG') or raw[:4]==b'RIFF'):return None
            with tempfile.NamedTemporaryFile(suffix='.image') as file:
                file.write(raw);file.flush();probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','json',file.name],stderr=subprocess.DEVNULL))['streams'][0]
            if probe['width']<120 or probe['height']<70:return None
            extension='.png' if raw.startswith(b'\x89PNG') else '.webp' if raw[:4]==b'RIFF' else '.jpg'
            return {'animeId':anime_id,'url':url,'source':provenance,'sha256':hashlib.sha256(raw).hexdigest(),'width':probe['width'],'height':probe['height'],'key':hashlib.sha256(url.encode()).hexdigest()[:32]+extension}
        except (subprocess.CalledProcessError,ValueError,KeyError,IndexError):return None
    by_id={a['id']:a for a in pack['anime']};added=[];hashes={}
    with ThreadPoolExecutor(max_workers=3) as workers:
        for record in workers.map(verify,candidates[:limit]):
            if not record:continue
            if record['sha256'] in hashes.setdefault(record['animeId'],set()):continue
            hashes[record['animeId']].add(record['sha256']);registry[record['key']]={'url':record['url'],'kind':'image'};by_id[record['animeId']]['screenshots'].append('media/'+record['key']);added.append(record)
    assert pack['key']==before['key'] and [a['id'] for a in pack['anime']]==[a['id'] for a in before['anime']]
    for old in before['anime']:
        current=by_id[old['id']];assert current['screenshots'][:len(old['screenshots'])]==old['screenshots']
        assert {k:v for k,v in old.items() if k!='screenshots'}=={k:v for k,v in current.items() if k!='screenshots'}
    report={'date':date.today().isoformat(),'rightsStatus':'Public-use permissions unverified; no publication authorised.','addedScenes':len(added),'updatedAnime':len({r['animeId'] for r in added}),'anime':[{'id':a['id'],'before':len(next(old for old in before['anime'] if old['id']==a['id'])['screenshots']),'after':len(a['screenshots'])} for a in pack['anime'] if a['id'] in {r['animeId'] for r in added}],'scenes':added}
    for name,value in [('pool.json',pack),('media-index.json',registry),('scene-update.json',report)]:
        path=ROOT/'data'/name;tmp=path.with_suffix('.json.tmp');tmp.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8');tmp.replace(path)
    print(json.dumps({k:v for k,v in report.items() if k!='scenes'}),flush=True)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--days',type=int,default=60);p.add_argument('--limit',type=int,default=120);args=p.parse_args();update(args.days,args.limit)
