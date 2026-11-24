from privacy_fixture import open_app
"""Real local-save history, SVG category controls, keyboard inspection and responsive stats."""
from pathlib import Path
from datetime import date,timedelta
import os,json
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];URL=os.environ.get('ANILOOP_URL','http://localhost:8100')
with sync_playwright() as pw:
    browser=pw.chromium.launch();page=browser.new_page(viewport={'width':1440,'height':1100});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    open_app(page,URL);page.locator('.hero').wait_for();page.locator('[data-action=stats]').first.click();expect(page.locator('.stats-empty')).to_be_visible();expect(page.locator('.stats-metrics article')).to_have_count(4)
    # Populate only this isolated browser context. The user's saves are untouched.
    today=date.today();history=[]
    for i in range(29):
        if i in [4,5,16,20]:continue
        day=(today-timedelta(days=28-i)).isoformat();breakdown={'screenshot':15000+(i%4)*2500,'character':10000+(i%5)*2000,'opening':5000+(i%4)*2500,'ending':2500+(i%3)*2500,'anidle':5000+(i%4)*500}
        history.append({'key':'daily:'+day+':fixture','mode':'daily','number':day,'day':day,'date':day+'T12:00:00Z','score':sum(breakdown.values()),'complete':True,'breakdown':breakdown,'packName':'Test pool'})
    history.append({'key':'daily:old','mode':'daily','number':(today-timedelta(days=50)).isoformat(),'date':(today-timedelta(days=50)).isoformat()+'T12:00:00Z','score':68000,'complete':True,'packName':'Older save'})
    history.append({'key':'infinity:fixture','mode':'infinity','number':3,'date':today.isoformat()+'T12:00:00Z','score':80000,'complete':True,'breakdown':{'screenshot':25000,'character':25000,'opening':10000,'ending':10000,'anidle':10000},'packName':'Test pool'})
    page.evaluate('''history=>{const state=JSON.parse(localStorage.getItem('aniloop-state-v1'));state.history=history;localStorage.setItem('aniloop-state-v1',JSON.stringify(state));}''',history)
    page.reload();page.locator('main h1').wait_for();page.locator('[data-action=home]').first.click();page.locator('.hero').wait_for();page.locator('[data-action=stats]').first.click();expect(page.locator('.score-history-chart')).to_be_visible();expect(page.locator('.stats-metrics')).to_contain_text('68,000')
    for category in ['screenshot','character','opening','ending','anidle','total']:assert page.locator('[data-stats-line="'+category+'"]').count()>0
    page.locator('input[data-stats-series=total]').uncheck();expect(page.locator('[data-stats-line=total]')).to_have_count(0);page.locator('input[data-stats-series=total]').check()
    page.locator('input[data-stats-average=total]').check();expect(page.locator('line[data-stats-average=total]')).to_have_count(1)
    page.locator('[data-stat-point="0"]').focus();expect(page.locator('#stats-readout')).to_contain_text('Total');page.locator('[data-stat-point="0"]').press('ArrowRight');assert page.locator('[data-stat-point="1"]').evaluate('(el)=>document.activeElement===el')
    page.locator('.stats-data-table summary').click();expect(page.locator('.stats-data-table tbody tr')).to_have_count(25)
    page.locator('#stats-range').select_option('7');expect(page.locator('.stats-data-table tbody tr')).to_have_count(7)
    page.locator('[data-action="stats-mode:infinity"]').click();expect(page.locator('.stats-data-table')).to_contain_text('80,000')
    page.locator('[data-action="stats-mode:daily"]').click();page.locator('#stats-range').select_option('30');page.locator('#toast').evaluate("el=>el.classList.remove('visible')")
    page.screenshot(path=str(ROOT/'qa/statistics-desktop.png'),full_page=True)
    for width in [1200,1024,768,390,320]:
        page.set_viewport_size({'width':width,'height':1000});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
    page.screenshot(path=str(ROOT/'qa/statistics-mobile.png'),full_page=True)
    # Save and reload: selected UI filters are ephemeral, history remains unchanged.
    page.reload();page.locator('main h1').wait_for();page.locator('[data-action=home]').first.click();page.locator('.hero').wait_for();assert page.evaluate("JSON.parse(localStorage.getItem('aniloop-state-v1')).history.length")==len(history)
    page.locator('[data-action="play:screenshot"]:visible').first.click();page.locator('[data-action=giveup]').click()
    stored=page.evaluate("JSON.parse(localStorage.getItem('aniloop-state-v1'))");assert stored['statistics']['activityDays'] and stored['statistics']['rounds'][0]['breakdown']['screenshot']==0
    assert not errors,errors;browser.close();print('PASS: empty stats, real-save aggregation, honest legacy totals, category/average toggles, keyboard chart, date/mode filters, mobile layout, and detailed tracking without save reset')
