"""Bounded, anonymous bug reports; no public read endpoint or external submission."""
import json,secrets,time
from community import APIError
CATEGORIES=('General','Screenshots','Characters','Openings','Endings','Anidle','Multiplayer','Appearance')
class BugReports:
    def __init__(self,community):
        self.community=community
        with community.db() as db:
            db.execute('CREATE TABLE IF NOT EXISTS bug_reports(id TEXT PRIMARY KEY,title TEXT NOT NULL,category TEXT NOT NULL,steps TEXT NOT NULL,expected TEXT NOT NULL,actual TEXT NOT NULL,diagnostics TEXT NOT NULL,created INTEGER NOT NULL)')
    def submit(self,payload,address):
        try:self.community.throttle('bugs:'+address)
        except APIError:raise APIError('Too many reports. Try again in ten minutes.',429)
        limits={'title':(5,120),'steps':(10,3000),'expected':(0,2000),'actual':(10,3000)};data={}
        for key,(minimum,maximum) in limits.items():
            value=payload.get(key,'')
            if not isinstance(value,str) or not minimum<=len(value.strip())<=maximum:raise APIError(f'{key.capitalize()} must contain {minimum}–{maximum} characters.')
            data[key]=value.strip()
        category=payload.get('category','General')
        if category not in CATEGORIES:raise APIError('Choose a valid report category.')
        diagnostics=payload.get('diagnostics',{})
        if not isinstance(diagnostics,dict):raise APIError('Invalid diagnostics.')
        safe={}
        for key in ('browser','viewport','theme','background','page','appVersion'):
            value=diagnostics.get(key)
            if value is not None:
                if not isinstance(value,str) or len(value)>500:raise APIError('Invalid diagnostics.')
                safe[key]=value
        identifier='BUG-'+secrets.token_hex(5).upper()
        with self.community.db() as db:
            db.execute('BEGIN IMMEDIATE')
            if db.execute('SELECT COUNT(*) FROM bug_reports').fetchone()[0]>=1000:raise APIError('The report inbox is full. Download your report and share it with the server owner.',503)
            db.execute('INSERT INTO bug_reports VALUES(?,?,?,?,?,?,?,?)',(identifier,data['title'],category,data['steps'],data['expected'],data['actual'],json.dumps(safe),int(time.time())))
        return {'id':identifier}
