"""Reference-inspired picker, top navigation, original features and narrow layouts."""
from privacy_fixture import open_app
from pathlib import Path
import os
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];URL=os.environ.get('ANILOOP_URL','http://localhost:8100')
with sync_playwright() as pw:
    browser=pw.chromium.launch();page=browser.new_page(viewport={'width':1440,'height':1100});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    open_app(page,URL);expect(page.locator('.hero')).to_be_visible();expect(page.locator('.category-card')).to_have_count(5)
    expect(page.locator('.hub-create-card')).to_be_visible();expect(page.locator('.hub-hero h1')).to_contain_text('What are we')
    assert page.locator('.sidebar').evaluate('el=>getComputedStyle(el).position')=='relative'
    assert page.locator('.page').bounding_box()['x']<160
    page.locator('.theme-shortcut').click();expect(page.locator('.theme-collection')).to_be_visible()
    page.locator('.sidebar-links [data-action=home]').click();page.locator('.hub-create-card').click();expect(page.locator('#library-search')).to_be_visible()
    for name,heading in [('stats','Your anime record'),('friends','Your friends'),('rooms','Same anime'),('appearance','Make the loop')]:
        page.locator('.sidebar-links [data-action='+name+']').click();expect(page.locator('main h1')).to_contain_text(heading,ignore_case=True)
    page.locator('.sidebar-links [data-action=home]').click();page.screenshot(path=str(ROOT/'qa/hub-desktop.png'),full_page=True)
    for width in [1200,1024,768,390,320]:
        page.set_viewport_size({'width':width,'height':1100});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
        expect(page.locator('.theme-shortcut')).to_be_visible();expect(page.locator('.account-entry')).to_be_visible()
    page.screenshot(path=str(ROOT/'qa/hub-mobile.png'),full_page=True)
    page.locator('.category-card[data-action="play:screenshot"]:visible').click();expect(page.locator('.game-heading')).to_be_visible();expect(page.locator('nav[aria-label=categories]')).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    assert not errors,errors;browser.close();print('PASS: top navigation, five game cards, custom pool entry, visible themes/account, preserved feature navigation and 320–1440px hub/game layout')
