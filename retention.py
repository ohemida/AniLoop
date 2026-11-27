"""Bounded housekeeping. Never expires accounts, scores, inventory or browser media."""
from pathlib import Path
from contextlib import closing
from datetime import datetime,timezone
import calendar,json,os,re,secrets,sqlite3,threading,time,tempfile
DAY=86400
REPORT_DAYS=90
LOG_DAYS=7
BACKUP_DAYS=30
CASE_DAYS=365

def month_deadline(timestamp):
    value=datetime.fromtimestamp(timestamp,timezone.utc);year=value.year+(value.month==12);month=value.month%12+1
    return int(value.replace(year=year,month=month,day=min(value.day,calendar.monthrange(year,month)[1])).timestamp())

def cleanup(db,now=None):
    now=int(time.time()) if now is None else int(now);tables={r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")};result={}
    for table,condition,cutoff in [('supabase_sessions','expires < ?',now),('sessions','expires < ?',now),('rooms','updated < ?',now-DAY),('bug_reports','created < ?',now-REPORT_DAYS*DAY),('privacy_cases','closed IS NOT NULL AND closed < ?',now-CASE_DAYS*DAY)]:
        if table in tables:result[table]=db.execute('DELETE FROM '+table+' WHERE '+condition,(cutoff,)).rowcount
    if 'privacy_cases' in tables:db.execute("UPDATE privacy_cases SET reference='' WHERE closed IS NOT NULL AND closed < ?",(now-BACKUP_DAYS*DAY,))
    return result

class Maintenance:
    def __init__(self,community,backups=False,access_logs=False):
        self.community=community;self.directory=community.path.parent/'privacy-managed'/community.path.name;self.backups=backups;self.access_logs=access_logs;self.lock=threading.Lock();self.stopped=threading.Event();os.chmod(community.path,0o600)
        with community.db() as db:db.execute('CREATE TABLE IF NOT EXISTS privacy_cases(id TEXT PRIMARY KEY,request_type TEXT NOT NULL,reference TEXT NOT NULL,opened INTEGER NOT NULL,due INTEGER NOT NULL,closed INTEGER)')
    def prune_files(self,now):
        counts={'logs':0,'backups':0}
        # Only our own conventionally named regular files, never old user backups or symlinks.
        for subdir,pattern,days,label in [('logs',r'access-\d{4}-\d{2}-\d{2}\.jsonl',LOG_DAYS,'logs'),('backups',r'snapshot-\d{4}-\d{2}-\d{2}\.sqlite3(?:\.[A-Za-z0-9_-]+\.part)?',BACKUP_DAYS,'backups')]:
            folder=self.directory/subdir
            if not folder.exists():continue
            for path in folder.iterdir():
                if not path.is_symlink() and path.is_file() and re.fullmatch(pattern,path.name) and path.stat().st_mtime<now-days*DAY:path.unlink();counts[label]+=1
        return counts
    def snapshot(self,now):
        folder=self.directory/'backups';folder.mkdir(parents=True,exist_ok=True,mode=0o700);os.chmod(folder,0o700)
        target=folder/('snapshot-'+datetime.fromtimestamp(now,timezone.utc).strftime('%Y-%m-%d')+'.sqlite3')
        if target.exists():return
        descriptor,temporary_name=tempfile.mkstemp(prefix=target.name+'.',suffix='.part',dir=folder);os.close(descriptor);temporary=Path(temporary_name)
        try:
            with closing(sqlite3.connect(self.community.path)) as source,closing(sqlite3.connect(temporary)) as destination:source.backup(destination)
            temporary.replace(target)
        finally:temporary.unlink(missing_ok=True)
    def run(self,now=None):
        now=int(time.time()) if now is None else int(now)
        with self.lock:
            with self.community.db() as db:result=cleanup(db,now)
            result.update(self.prune_files(now))
            if self.backups:self.snapshot(now)
            return result
    def log_request(self,status):
        if not self.access_logs:return
        with self.lock:
            folder=self.directory/'logs';folder.mkdir(parents=True,exist_ok=True,mode=0o700);os.chmod(folder,0o700)
            path=folder/('access-'+datetime.now(timezone.utc).strftime('%Y-%m-%d')+'.jsonl')
            if path.exists() and path.stat().st_size>=1024*1024:return
            descriptor=os.open(path,os.O_CREAT|os.O_APPEND|os.O_WRONLY,0o600)
            with os.fdopen(descriptor,'a',encoding='utf-8') as file:file.write(json.dumps({'time':int(time.time()),'status':int(status)})+'\n')
    def start(self):
        self.run()
        def worker():
            while not self.stopped.wait(3600):
                try:self.run()
                except Exception:print('AniLoop maintenance failed; check local storage permissions.',flush=True)
        self.thread=threading.Thread(target=worker,daemon=True);self.thread.start()
    def stop(self):
        self.stopped.set()
        if hasattr(self,'thread'):self.thread.join(timeout=5)
    def open_case(self,request_type,reference,now=None):
        if request_type not in {'access','correction','deletion','restriction','portability','objection','incident'}:raise ValueError('Unknown request type')
        if not isinstance(reference,str) or not re.fullmatch(r'[A-Za-z0-9:._-]{1,120}',reference):raise ValueError('Use a short internal reference; do not include passwords or full correspondence.')
        now=int(time.time()) if now is None else int(now);identifier='PRIV-'+secrets.token_hex(5).upper();due=now+72*3600 if request_type=='incident' else month_deadline(now)
        with self.community.db() as db:db.execute('INSERT INTO privacy_cases VALUES(?,?,?,?,?,NULL)',(identifier,request_type,reference,now,due))
        return {'id':identifier,'due':datetime.fromtimestamp(due,timezone.utc).isoformat()}
    def close_case(self,identifier,now=None):
        with self.community.db() as db:
            if db.execute('UPDATE privacy_cases SET closed=? WHERE id=? AND closed IS NULL',(int(time.time()) if now is None else int(now),identifier)).rowcount!=1:raise ValueError('No open case found')
