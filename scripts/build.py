"""Build a sanitized repository/backend package in build/; never publish it."""
from pathlib import Path
import hashlib,json,tempfile
try:
    from .prepare_release import prepare,ROOT
except ImportError:
    from prepare_release import prepare,ROOT

MARKER='.aniloop-build.json'
GENERATOR='aniloop-clean-build-v1'

def hashes(directory):
    result={}
    for path in directory.rglob('*'):
        if path.is_symlink():raise ValueError('Build contains a symlink; move it aside before rebuilding.')
        if path.is_file() and path!=directory/MARKER:
            result[path.relative_to(directory).as_posix()]=hashlib.sha256(path.read_bytes()).hexdigest()
    return result

def check_replaceable(directory):
    if directory.is_symlink():raise ValueError('Refusing to replace a symlink named build.')
    if not directory.exists():return
    if not directory.is_dir():raise ValueError('build exists and is not a directory.')
    marker=directory/MARKER
    if marker.is_symlink() or not marker.is_file():
        raise ValueError('Existing build/ is not owned by this command. Move it aside first; nothing was removed.')
    try:record=json.loads(marker.read_text())
    except (ValueError,OSError) as error:raise ValueError('Build marker is unreadable; move build/ aside first.') from error
    if record.get('generator')!=GENERATOR or record.get('files')!=hashes(directory):
        raise ValueError('build/ contains added or changed files, possibly accounts or custom media. Move it aside first; nothing was removed.')

def build(output=None,prepare_fn=prepare):
    output=Path(output) if output is not None else ROOT/'build'
    if output.name!='build':raise ValueError('Output directory must be named build.')
    check_replaceable(output)
    # Generate completely before replacing a previously generated, unchanged build.
    with tempfile.TemporaryDirectory(prefix='.aniloop-build-',dir=output.parent) as staging:
        staging=Path(staging);pending=staging/'package';prepare_fn(pending)
        (pending/'BUILD_STATUS.json').write_text(json.dumps({
            'artifact':'repository-and-python-backend',
            'githubPagesStandalone':False,
            'publicLaunchCleared':False,
            'requires':['Python backend','persistent database','ffmpeg','review PUBLIC_LAUNCH.md'],
            'supabaseIntegration':'Supabase Auth/profiles connected; game data stays on Python/SQLite; account_actions.sql required for cloud export/deletion'
        },indent=2)+'\n')
        (pending/MARKER).write_text(json.dumps({'generator':GENERATOR,'files':hashes(pending)},sort_keys=True,indent=2)+'\n')
        check_replaceable(output)
        previous=staging/'previous'
        if output.exists():output.rename(previous)
        try:pending.rename(output)
        except OSError:
            if previous.exists():previous.rename(output)
            raise
    print(f'Build ready: {output}\nUpload the contents of build/ to the repository, including dotfiles.\nThis package requires the Python backend; it is not a standalone GitHub Pages build.\nNothing uploaded or published. Existing accounts, saves and custom media are untouched.')
    return output

if __name__=='__main__':
    try:build()
    except (ValueError,OSError) as error:raise SystemExit(str(error))
