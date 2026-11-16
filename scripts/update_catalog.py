"""Append real public catalog entries and recent quiz media without replacing existing records."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from datetime import date,timedelta
from urllib.parse import urlparse
import base64,hashlib,html,json,subprocess,argparse
ROOT=Path(__file__).resolve().parents[1]
ORIGIN='https://cms.aniguessr.com'

def update(days=30,pages=33):
    cache=ROOT/'.tools/source-cache'/('refresh-'+date.today().isoformat());cache.mkdir(parents=True,exist_ok=True)
    def request(url):
        path=cache/(hashlib.sha256(url.encode()).hexdigest()+'.json')
        if path.exists():return json.loads(path.read_text())
        raw=subprocess.check_output(['curl','--fail','-L','-sS','--max-time','25',url]);value=json.loads(raw);path.write_text(json.dumps(value));return value
    pack=json.loads((ROOT/'data/pool.json').read_text());entries={a['id']:a for a in pack['anime']};before=set(entries)
    registry=json.loads((ROOT/'data/media-index.json').read_text())
    def asset(url,kind='image'):
        if not url or urlparse(url).hostname not in {'cms.aniguessr.com','medias.aniguessr.com','cdn.myanimelist.net','a.animethemes.moe','v.animethemes.moe','s4.anilist.co'}:return None
        ext=Path(urlparse(url).path).suffix.lower()
        if ext not in {'.jpg','.jpeg','.png','.webp','.mp3','.ogg','.mp4','.webm'}:ext={'image':'.jpg','audio':'.mp3','video':'.mp4'}[kind]
        key=hashlib.sha256(url.encode()).hexdigest()[:32]+ext;registry[key]={'url':url,'kind':kind};return 'media/'+key
    def entry(identifier,title):
        key='anime-'+str(identifier)
        if key not in entries:entries[key]={'id':key,'cmsId':str(identifier),'title':html.unescape(title),'aliases':[],'character':'','characterAliases':[],'characterImage':None,'year':None,'studio':'','source':'','score':None,'genres':[],'tags':[],'secondary':[],'synopsis':'','popularCharacter':'','screenshots':[],'difficulty':{},'opening':None,'ending':None,'cover':None,'characters':[]}
        return entries[key]
    with ThreadPoolExecutor(max_workers=3) as workers:
        catalog=list(workers.map(request,[ORIGIN+f'/wp-json/wp/v2/anime?per_page=100&page={page}&_fields=id,meta,terms,title' for page in range(1,pages+1)]))
    unsafe=set()
    for page in catalog:
        for row in page:
            meta=row.get('meta',{});terms=row.get('terms',{})
            if any(g.lower() in {'hentai','erotica'} for g in terms.get('genre',[])):unsafe.add(str(row['id']));continue
            a=entry(row['id'],meta.get('title') or row['title']['rendered'])
            a['aliases']=list(dict.fromkeys(a['aliases']+[html.unescape(t) for t in meta.get('alt_titles',[])]+([meta['title_2']] if meta.get('title_2') else [])))
            if a['id'] in before:continue
            a.update(alternativeTitle=html.unescape(meta.get('title_2','')),cover=asset(meta.get('cover')),malLink=meta.get('mal_link'),year=int(meta['aired_year']) if str(meta.get('aired_year','')).isdigit() else None,studio=' / '.join(terms.get('studio',[])),source=' / '.join(terms.get('source',[])),genres=terms.get('genre',[]),tags=terms.get('tags_primary',[]),secondary=terms.get('tags_secondary',[]),catalogSource=ORIGIN+f'/database/anime/{row["id"]}')
            a['difficulty']['anidle']=meta.get('difficulty') or 'Medium'
    jobs=[(kind,(date.today()-timedelta(days=i)).strftime('%Y%m%d')) for i in range(days) for kind in ['screenshots','characters','music','endings']]
    def daily(job):
        kind,day=job
        try:
            data=request(ORIGIN+f'/wp-json/aniguessr/v1/game/{kind}?date={day}');return kind,json.loads(base64.b64decode(data['game_data']))
        except (subprocess.CalledProcessError,KeyError,ValueError) as error:print('Skipped',kind,day,type(error).__name__,flush=True);return kind,[]
    with ThreadPoolExecutor(max_workers=3) as workers:
        for kind,rows in workers.map(daily,jobs):
            for row in rows:
                if row.get('nsfw'):continue
                if kind=='characters':
                    for c in row.get('characters',[]):
                        ids=c.get('anime_id') or [];ids=list(ids.values()) if isinstance(ids,dict) else ids
                        if not ids or str(ids[0]) in unsafe:continue
                        image=asset(c.get('image'))
                        if not image:continue
                        a=entry(ids[0],c.get('anime_title','').split(' / ')[0])
                        if not any(v['id']==str(c['id']) for v in a['characters']):a['characters'].append({'id':str(c['id']),'name':c['name'],'aliases':c.get('accepted_names',[]),'image':image,'difficulty':row.get('difficulty','Medium')})
                    continue
                if str(row['id']) in unsafe:continue
                a=entry(row['id'],row['title']);a['aliases']=list(dict.fromkeys(a['aliases']+row.get('accepted_titles',[])))
                if kind=='screenshots':
                    a['difficulty'].setdefault('screenshot',row['difficulty'])
                    for url in row.get('screenshots',[]):
                        src=asset(url)
                        if src and src not in a['screenshots']:a['screenshots'].append(src)
                else:
                    category='opening' if kind=='music' else 'ending'
                    if not a[category]:
                        audio=asset(row.get('local_audio') or row.get('audio'),'audio');video=asset(row.get('local_video') or row.get('video'),'video')
                        if audio and video:a[category]={'audio':audio,'video':video,'fullLength':True,'videoStartFraction':0,'demo':False,'song':row.get('song_title',''),'artist':row.get('artists',''),'difficulty':row['difficulty']}
    from scripts.finalize_pool import finalize,report
    pack['anime']=[a for a in entries.values() if a['cmsId'] not in unsafe or a['id'] in before]
    pack=finalize(pack,registry);pack['builtAt']=date.today().isoformat()
    # Retain pack identity, every existing ID, and all original source files/saves.
    assert before.issubset({a['id'] for a in pack['anime']})
    for name,data in [('media-index.json',registry),('pool.json',pack),('pool-report.json',report(pack,registry))]:
        path=ROOT/'data'/name;temporary=path.with_suffix('.json.tmp');temporary.write_text(json.dumps(data,ensure_ascii=False,indent=2));temporary.replace(path)
    added=[{'id':a['id'],'title':a.get('alternativeTitle') or a['title']} for a in pack['anime'] if a['id'] not in before]
    print(json.dumps({'added':added,'report':report(pack,registry)},indent=2),flush=True)
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--days',type=int,default=30);parser.add_argument('--pages',type=int,default=33);args=parser.parse_args();update(args.days,args.pages)
