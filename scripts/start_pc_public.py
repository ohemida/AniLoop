"""Restart the already-configured PC preview and print its current public URL."""
import argparse,json,os,re,subprocess,time
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def docker(*args):
    return subprocess.check_output(['docker',*args],stderr=subprocess.STDOUT,text=True)
def inspect(name):return json.loads(docker('inspect',name))[0]
def main():
    argparse.ArgumentParser(description=__doc__).parse_args()
    compose=ROOT/'.tools/pc-host/release/compose.private.yml'
    envfile=ROOT/'.tools/pc-host/public.env'
    if not compose.is_file():raise RuntimeError('The PC deployment is missing. Restore it before restarting; do not create a new empty database.')
    app=inspect('aniloop-pc-app-1');tunnel=inspect('aniloop-pc-tunnel')
    if app['Config'].get('Labels',{}).get('com.docker.compose.project')!='aniloop-pc':raise RuntimeError('Unexpected application container; refusing to change it.')
    if tunnel['Config']['Image']!='cloudflare/cloudflared:latest' or 'http://127.0.0.1:8110' not in tunnel['Config']['Cmd']:raise RuntimeError('Unexpected tunnel container; refusing to change it.')
    if not tunnel['State']['Running']:
        # Avoid serving the previous hostname configuration during tunnel setup.
        if app['State']['Running']:docker('stop','aniloop-pc-app-1')
        print('Starting public tunnel…',flush=True);docker('start','aniloop-pc-tunnel')
    started=inspect('aniloop-pc-tunnel')['State']['StartedAt']
    url=None
    for _ in range(90):
        logs=docker('logs','--since',started,'aniloop-pc-tunnel')
        matches=re.findall(r'https://[a-z0-9-]+\.trycloudflare\.com',logs)
        if matches:url=matches[-1];break
        if not inspect('aniloop-pc-tunnel')['State']['Running']:raise RuntimeError('Tunnel stopped. Check: docker logs --tail 30 aniloop-pc-tunnel')
        time.sleep(1)
    if not url:raise RuntimeError('No public address yet. Check: docker logs --tail 30 aniloop-pc-tunnel')
    values=dict(item.split('=',1) for item in app['Config']['Env'] if '=' in item)
    previous=envfile.read_text(encoding='utf-8') if envfile.exists() else ''
    contents=f'ANILOOP_PUBLIC_ORIGIN={url}\nANILOOP_SECURE_COOKIES=1\n'
    # Preserve the exact-origin setting on future Compose recreations.
    with envfile.open('w',encoding='utf-8') as f:os.fchmod(f.fileno(),0o600);f.write(contents)
    if values.get('ANILOOP_PUBLIC_ORIGIN')!=url or values.get('ANILOOP_SECURE_COOKIES')!='1':
        print('Updating public origin and secure cookies…',flush=True)
        docker('compose','--env-file',str(envfile),'-p','aniloop-pc','-f',str(compose),'up','-d','--no-build')
    elif not app['State']['Running']:docker('start','aniloop-pc-app-1')
    print(f'\nShare this address: {url}\nKeep this PC awake, online, and Docker running.')
    if previous!=contents:print(f'For email confirmations, update Supabase Site URL and Redirect URLs to {url}/')
    print('Stop public access: docker stop aniloop-pc-tunnel')

if __name__=='__main__':
    try:main()
    except subprocess.CalledProcessError:
        raise SystemExit('Docker command failed. Ensure Docker is running and the existing AniLoop containers are available. No account volumes were deleted.')
    except (RuntimeError,OSError) as error:raise SystemExit(str(error))
