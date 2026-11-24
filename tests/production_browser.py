"""HTTPS proxy acceptance against an explicitly disposable staging installation.

ANILOOP_DISPOSABLE_QA=1 is mandatory. Certificate bypass is only allowed on
localhost with ANILOOP_LOCAL_TLS_QA=1, never on a public staging hostname.
"""
import json, os, uuid
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

URL=os.environ.get('ANILOOP_URL','')
assert os.environ.get('ANILOOP_DISPOSABLE_QA')=='1', 'Use a disposable staging database.'
origin=urlsplit(URL)
assert origin.scheme=='https' and origin.hostname, 'Use an HTTPS staging origin.'
local_bypass=os.environ.get('ANILOOP_LOCAL_TLS_QA')=='1'
assert not local_bypass or origin.hostname in {'localhost','127.0.0.1'}, 'Never bypass public TLS verification.'
with sync_playwright() as pw:
    browser=pw.chromium.launch()
    context=browser.new_context(ignore_https_errors=local_bypass)
    request=context.request
    health=request.get(URL+'/api/health')
    assert health.ok, health.text()
    assert 'max-age=' in health.headers['strict-transport-security']
    assert health.headers['x-content-type-options']=='nosniff'
    assert "script-src 'self'" in health.headers['content-security-policy']
    assert health.headers['cache-control']=='no-store'
    name='TLS_'+uuid.uuid4().hex[:10]
    password='Disposable HTTPS test password!'
    assert request.post(URL+'/api/register',data={'username':name,'password':password},headers={'Origin':URL}).status==400
    assert request.post(URL+'/api/register',data={'adultConfirmed':False,'username':name,'password':password},headers={'Origin':URL}).status==400
    registered=request.post(URL+'/api/register',data={'adultConfirmed':True,'username':name,'password':password},headers={'Origin':URL})
    assert registered.ok,registered.text()
    cookie=registered.headers['set-cookie'].lower()
    assert all(flag in cookie for flag in ['secure','httponly','samesite=lax'])
    exported=request.get(URL+'/api/account/export')
    assert exported.ok and exported.json()['account']['username']==name
    assert 'scrypt$' not in exported.text() and '"token"' not in exported.text()
    rejected=request.post(URL+'/api/logout',data={},headers={'Origin':'https://unrelated.invalid'})
    assert rejected.status==403
    assert request.get(URL+'/api/account/export').ok
    assert request.post(URL+'/api/account/delete',data={'password':'wrong'},headers={'Origin':URL}).status>=400
    assert request.post(URL+'/api/account/delete',data={'password':password},headers={'Origin':URL}).ok
    assert request.get(URL+'/api/account/export').status==401
    assert request.post(URL+'/api/login',data={'adultConfirmed':True,'username':name,'password':password},headers={'Origin':URL}).status>=400
    oversized=request.post(URL+'/api/register',data='x'*(1024*1024+1),headers={'Content-Type':'application/json','Origin':URL})
    assert oversized.status==413,oversized.status
    context.close();browser.close()
print('PASS: HTTPS health/HSTS/CSP support, secure session, registration/export/deletion, origin rejection and proxy body limit')
