"""Add distinct, sourced anime with complete Anidle clues from AniList's public API."""
from pathlib import Path
import argparse,hashlib,html,json,re,subprocess
from scripts.finalize_pool import report
ROOT=Path(__file__).resolve().parents[1]
def add(limit=30,pages=3):
    pack=json.loads((ROOT/'data/pool.json').read_text());registry=json.loads((ROOT/'data/media-index.json').read_text());existing={re.search(r'/anime/(\d+)',a.get('malLink') or '').group(1) for a in pack['anime'] if re.search(r'/anime/(\d+)',a.get('malLink') or '')};added=[]
    cache=ROOT/'.tools/source-cache';cache.mkdir(exist_ok=True,parents=True)
    for page in range(1,pages+1):
        query='query { Page(page:%d,perPage:50) { media(type:ANIME,sort:POPULARITY_DESC,isAdult:false) { id idMal title { romaji english native } coverImage { large } startDate { year } averageScore source genres tags { name isAdult } studios(isMain:true) { nodes { name } } description(asHtml:false) characters(sort:FAVOURITES_DESC,perPage:1) { nodes { id name { full alternative } image { large } } } } } }'%page
        path=cache/('aniloop-add-'+hashlib.sha256(query.encode()).hexdigest()+'.json')
        if path.exists():data=json.loads(path.read_text())
        else:
            data=json.loads(subprocess.check_output(['curl','--fail','--silent','--show-error','--max-time','30','https://graphql.anilist.co','-H','Content-Type: application/json','--data',json.dumps({'query':query})]));path.write_text(json.dumps(data))
        for row in data['data']['Page']['media']:
            mal=str(row['idMal']);nodes=row['characters']['nodes'];year=row['startDate']['year'];studio=' / '.join(n['name'] for n in row['studios']['nodes']);description=html.unescape(re.sub('<[^>]+>',' ',row.get('description') or ''));description=re.sub(r'\s+',' ',description).strip()
            if mal=='None' or mal in existing or not (year and studio and description and nodes and row['averageScore'] and row['source'] and row['genres']):continue
            url=row['coverImage']['large']
            if not url.startswith('https://s4.anilist.co/'):continue
            extension=Path(url.split('?')[0]).suffix or '.jpg';key=hashlib.sha256(url.encode()).hexdigest()[:32]+extension;registry[key]={'url':url,'kind':'image'}
            title=row['title'];aliases=list(dict.fromkeys(t for t in title.values() if t));rank=len(pack['anime'])
            anime={'id':'anime-mal-'+mal,'cmsId':mal,'title':title['romaji'] or title['english'],'alternativeTitle':title['english'] or '', 'englishTitle':title['english'] or '', 'japaneseTitle':title['romaji'] or title['native'],'aliases':aliases,'year':year,'studio':studio,'source':row['source'].replace('_',' ').title(),'score':row['averageScore']/10,'scoreSource':'AniList','genres':row['genres'],'tags':[t['name'] for t in row['tags'] if not t['isAdult']][:12],'secondary':[],'synopsis':description[:650].rsplit(' ',1)[0]+'…' if len(description)>650 else description,'popularCharacter':nodes[0]['name']['full'],'cover':'media/'+key,'screenshots':[],'characters':[],'character':'','characterAliases':[],'characterImage':None,'opening':None,'ending':None,'difficulty':{'anidle':'Medium'},'malLink':'https://myanimelist.net/anime/'+mal,'clueSource':'https://anilist.co/anime/'+str(row['id']),'catalogSource':'https://anilist.co/anime/'+str(row['id'])}
            pack['anime'].append(anime);existing.add(mal);added.append(anime['alternativeTitle'] or anime['title'])
            if len(added)>=limit:break
        if len(added)>=limit:break
    for name,value in [('media-index.json',registry),('pool.json',pack),('pool-report.json',report(pack,registry))]:
        path=ROOT/'data'/name;temp=path.with_suffix('.json.tmp');temp.write_text(json.dumps(value,ensure_ascii=False,indent=2));temp.replace(path)
    print(json.dumps({'added':added,'report':report(pack,registry)},indent=2))
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--limit',type=int,default=30);parser.add_argument('--pages',type=int,default=3);args=parser.parse_args();add(args.limit,args.pages)
