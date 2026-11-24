"""Existing feature regressions start with an acknowledged necessary-only fixture.
The separate privacy_choice_browser.py exercises the real, unseeded first visit.
"""
from pathlib import Path
import re,json
ROOT=Path(__file__).resolve().parents[1]
VERSION=re.search(r"POLICY_VERSION='([^']+)'",(ROOT/'assets/policies.js').read_text()).group(1)
def open_app(page,url,**kwargs):
    page.add_init_script('''(()=>{if(!localStorage.getItem('aniloop-privacy-v1'))localStorage.setItem('aniloop-privacy-v1',JSON.stringify({version:'notice-choice-v2-adult',policyVersion:VERSION,acknowledged:true,adultConfirmed:true,choice:'necessary',optionalPurposes:[],savedAt:Date.now()}));})();'''.replace('policyVersion:VERSION','policyVersion:'+json.dumps(VERSION)))
    return page.goto(url,**kwargs)
