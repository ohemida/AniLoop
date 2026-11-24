"""Create irreversible hint derivatives; never serve original pixels as a hint."""
import base64, hashlib, json, subprocess, threading, os
from pathlib import Path

TRANSFORM_VERSION = 'opening-window-v4-light'

class HintMedia:
    def __init__(self, root, media_cache):
        self.root = Path(root)
        self.media_cache = media_cache
        self.directory = self.root / '.tools/hint-cache'
        self.directory.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        self.slots = threading.Semaphore(2)
        self.locks = {}

    def source(self, value):
        if not isinstance(value, str):
            raise ValueError('Invalid media source')
        if value.startswith('media/'):
            return self.media_cache.get(value[6:])
        if value.startswith('assets/media/'):
            path = (self.root / value).resolve()
            if path.is_relative_to((self.root / 'assets/media').resolve()) and path.is_file():
                return path
        if value.startswith('data:'):
            header, encoded = value.split(',', 1)
            allowed = {'image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm'}
            mime = header[5:].split(';')[0]
            if mime not in allowed or ';base64' not in header:
                raise ValueError('Unsupported upload')
            data = base64.b64decode(encoded, validate=True)
            if len(data) > 25 * 1024**2:
                raise ValueError('Upload exceeds 25 MB')
            path = self.directory / (hashlib.sha256(data).hexdigest() + '.upload')
            with self.lock:
                if not path.exists():
                    path.write_bytes(data)
            return path
        # Only checked-in registry URLs may be fetched. No arbitrary URL proxy.
        for key, record in self.media_cache._registry().items():
            if record['url'] == value:
                return self.media_cache.get(key)
        raise ValueError('Hint source must be a registered source or an uploaded file')

    def create(self, spec):
        kind = spec.get('kind')
        if kind not in {'cover', 'opening', 'ending'}:
            raise ValueError('Invalid hint type')
        # Browser element IDs and irrelevant ending windows must not fragment the cache.
        spec = {key: spec[key] for key in ('source', 'kind', 'window') if key in spec and (key != 'window' or kind == 'opening')}
        key = hashlib.sha256(json.dumps({"version": TRANSFORM_VERSION, "spec": spec}, sort_keys=True).encode()).hexdigest()
        suffix = '.jpg' if kind == 'cover' else '.mp4'
        target = self.directory / (key + suffix)
        info_path = self.directory / (key + '.json')
        with self.lock:
            lock = self.locks.setdefault(key, threading.Lock())
        with lock:
            if target.exists() and info_path.exists():
                os.utime(target, None)
                return json.loads(info_path.read_text())
            source = self.source(spec.get('source'))
            with self.slots:
                args = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-threads', '2', '-filter_threads', '1']
                info = {'url': '/hints/' + target.name, 'offset': 0}
                if kind == 'cover':
                    args += ['-i', str(source), '-vf', 'scale=48:-1,boxblur=2:1,scale=240:-1', '-frames:v', '1', '-update', '1']
                else:
                    probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(source)], capture_output=True, timeout=30, check=True)
                    duration = float(json.loads(probe.stdout)['format']['duration'])
                    if not 0 < duration <= 1800:
                        raise ValueError('Unsupported video duration')
                    start, end = 0, duration
                    if kind == 'opening':
                        window = spec.get('window') or {}
                        start = float(window.get('startSeconds', duration * float(window.get('startFraction', .35))))
                        end = min(duration, float(window.get('endSeconds', duration * float(window.get('endFraction', .65)))))
                        if not 0 <= start < end:
                            raise ValueError('Invalid opening window')
                    info.update(offset=start, end=end)
                    args += ['-ss', str(start), '-i', str(source), '-t', str(end-start), '-map', '0:v:0', '-map', '0:a:0?', '-vf', 'fps=20,scale=320:-2,boxblur=3:2', '-c:v', 'libx264', '-threads', '2', '-preset', 'ultrafast', '-crf', '28', '-c:a', 'aac', '-b:a', '128k', '-map_metadata', '-1', '-movflags', '+faststart']
                temporary = self.directory / (key + '.part' + suffix)
                try:
                    subprocess.run(args + [str(temporary)], capture_output=True, timeout=240, check=True)
                    temporary.replace(target)
                    info_path.write_text(json.dumps(info))
                finally:
                    temporary.unlink(missing_ok=True)
            # Bound generated media, including uploaded sources, to 2 GiB.
            with self.lock:
                files = [f for f in self.directory.iterdir() if f.is_file() and '.part' not in f.name]
                total = sum(f.stat().st_size for f in files)
                for file in sorted(files, key=lambda f: f.stat().st_mtime):
                    if total <= 2 * 1024**3:
                        break
                    if file in {target, info_path, source}:
                        continue
                    try:
                        total -= file.stat().st_size
                        file.unlink()
                    except FileNotFoundError:
                        pass
            return info

    def get(self, key):
        if not __import__('re').fullmatch(r'[a-f0-9]{64}\.(jpg|mp4)', key):
            raise FileNotFoundError('Unknown hint')
        path = self.directory / key
        if not path.is_file():
            raise FileNotFoundError('Unknown hint')
        return path
