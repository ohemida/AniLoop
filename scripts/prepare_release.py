"""Create a small GitHub upload folder without private/runtime or third-party media files."""
from pathlib import Path
import hashlib,json,shutil
ROOT=Path(__file__).resolve().parents[1]
def prepare(destination=None):
    out=Path(destination) if destination else ROOT/'.release/AniLoop'
    if out.exists():raise SystemExit(f'{out} already exists. Choose a fresh output folder or remove that generated folder yourself.')
    out.mkdir(parents=True)
    for name in ['app.js','friends.py','catalog.js','social-ui.js','core.js','storage.js','styles.css','skin.css','index.html','server.py','community.py','rooms.py','rewards.py','hint_media.py','media_cache.py','start.sh','package.json','README.md','DEPLOYMENT.md','.gitignore','.dockerignore','.env.example','Dockerfile','SECURITY.md','codex.md']:
        shutil.copy2(ROOT/name,out/name)
    for name in ['.github','scripts','tests']:
        shutil.copytree(ROOT/name,out/name,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
    shutil.copytree(ROOT/'assets',out/'assets',ignore=shutil.ignore_patterns('media'))
    (out/'data').mkdir()
    for file in (ROOT/'data').glob('*.json'):shutil.copy2(file,out/'data'/file.name)
    sources={r['path']:r for r in json.loads((ROOT/'data/media-sources.json').read_text())}
    registry=json.loads((ROOT/'data/media-index.json').read_text())
    def replace(value):
        if isinstance(value,dict):return {k:replace(v) for k,v in value.items()}
        if isinstance(value,list):return [replace(v) for v in value]
        if isinstance(value,str) and value.startswith('assets/media/'):
            source=sources.get(value)
            if not source:raise ValueError(f'No registered source for {value}')
            extension=Path(value).suffix
            key=hashlib.sha256(source['source'].encode()).hexdigest()[:32]+extension
            registry[key]={'url':source['source'],'kind':'video' if extension in {'.mp4','.webm'} else 'audio' if extension in {'.mp3','.ogg','.wav'} else 'image'}
            return 'media/'+key
        return value
    pool=replace(json.loads((ROOT/'data/pool.json').read_text()))
    (out/'data/pool.json').write_text(json.dumps(pool,ensure_ascii=False,separators=(',',':')))
    (out/'data/media-index.json').write_text(json.dumps(registry,ensure_ascii=False,separators=(',',':')))
    print(f'GitHub upload folder: {out}\nMedia loads on demand. No accounts, passwords, databases, caches, or bundled anime media copied.')
    return out
if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path);args=parser.parse_args();prepare(args.output)
