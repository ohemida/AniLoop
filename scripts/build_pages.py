"""Create a Python-free GitHub Pages bundle with Supabase public configuration."""
from pathlib import Path
import hashlib,json,shutil,sys

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'pages-build'
CONFIG=ROOT/'supabase/project.json'
def source_map():
    return {row['path']:row['source'] for row in json.loads((ROOT/'data/media-sources.json').read_text(encoding='utf-8'))}
def rewrite_pool(pool,registry,sources):
    def media(value):
        if not isinstance(value,str):return value
        if value.startswith('assets/media/'):
            if value not in sources:raise ValueError(f'Unregistered media path: {value}')
            return sources[value]
        if value.startswith('media/'):
            key=value[6:]
            if key not in registry:raise ValueError(f'Unknown media ID: {value}')
            return registry[key]['url']
        return value
    for anime in pool['anime']:
        anime['screenshots']=[media(x) for x in anime.get('screenshots',[])]
        for key in ('cover','characterImage'):
            if anime.get(key):anime[key]=media(anime[key])
        for key in ('opening','ending'):
            if anime.get(key):
                for prop in ('audio','video'):
                    if anime[key].get(prop):anime[key][prop]=media(anime[key][prop])
        for character in anime.get('characters',[]):
            character['image']=media(character['image'])
    return pool
def build(output=OUTPUT):
    output=Path(output)
    if output.exists():raise SystemExit(f'{output} already exists; move it aside manually before rebuilding. Nothing was removed.')
    config=json.loads(CONFIG.read_text(encoding='utf-8'))
    if not config.get('enabled') or not config.get('url') or not config.get('publishableKey'):
        raise SystemExit('Set the Supabase project URL and publishable key in supabase/project.json first.')
    output.mkdir(parents=True)
    files=['index.html','admin.html','app.js','catalog.js','social-ui.js','core.js','storage.js','styles.css']
    for name in files:shutil.copy2(ROOT/name,output/name)
    shutil.copytree(ROOT/'assets',output/'assets',ignore=shutil.ignore_patterns('media','*.py','__pycache__'))
    (output/'data').mkdir()
    registry=json.loads((ROOT/'data/media-index.json').read_text(encoding='utf-8'))
    pool=json.loads((ROOT/'data/pool.json').read_text(encoding='utf-8'))
    pool=rewrite_pool(pool,registry,source_map())
    (output/'data/pool.json').write_text(json.dumps(pool,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    shutil.copy2(ROOT/'data/media-index.json',output/'data/media-index.json')
    shutil.copy2(ROOT/'data/media-sources.json',output/'data/media-sources.json')
    runtime={'mode':'supabase','supabaseUrl':config['url'],'publishableKey':config['publishableKey'],'functionUrl':config['url'].rstrip('/')+'/functions/v1/aniloop','videoHintsEnabled':False}
    (output/'assets/runtime-config.js').write_text('export const runtimeConfig=Object.freeze('+json.dumps(runtime,separators=(',',':'))+');\n',encoding='utf-8')
    (output/'.nojekyll').write_text('',encoding='utf-8')
    # Never copy game DBs, account/session data, local media, caches, or service keys.
    hint_count=sum(1 for p in (ROOT/'.tools/hint-cache').glob('*.mp4')) if (ROOT/'.tools/hint-cache').exists() else 0
    status={'artifact':'github-pages-supabase-static','pythonRuntimeRequired':False,'edgeFunction':'supabase/functions/aniloop','databaseMigration':'supabase/cloud_runtime.sql','protectedVideoHints':'not bundled; no original or unblurred video is exposed','cachedLocalVideoDerivatives':hint_count,'requiresSupabaseFunctionDeployment':True}
    (output/'BUILD_STATUS.json').write_text(json.dumps(status,indent=2)+'\n',encoding='utf-8')
    print(f'Python-free Pages bundle created at {output} ({sum(p.stat().st_size for p in output.rglob("*") if p.is_file()):,} bytes).')
    print(f'Supabase Edge Function required. {hint_count} protected video derivatives exist in the private local cache but are not published by this build.')
    return output
if __name__=='__main__':
    try:build(Path(sys.argv[1]) if len(sys.argv)>1 else OUTPUT)
    except (ValueError,OSError,KeyError) as error:raise SystemExit(str(error))
