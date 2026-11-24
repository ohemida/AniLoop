"""Actual browser Back/Forward, duplicate prevention, deep links and no quiz rollback."""
from privacy_fixture import open_app
import os
from playwright.sync_api import sync_playwright,expect
URL=os.environ.get('ANILOOP_URL','http://localhost:8100')
with sync_playwright() as pw:
    browser=pw.chromium.launch();page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    open_app(page,URL);page.locator('.hero').wait_for();length=page.evaluate('history.length')
    for name,heading in [('library','Real scenes'),('stats','Your anime record'),('friends','Your friends')]:
        page.locator('.sidebar-links [data-action='+name+']').click();expect(page).to_have_url(__import__('re').compile('#'+name));expect(page.locator('main h1')).to_contain_text(heading,ignore_case=True)
    assert page.evaluate('history.length')==length+3
    for name in ['stats','library','home']:
        page.go_back();expect(page).to_have_url(__import__('re').compile('#'+name));expect(page.locator('.sidebar-links [data-action='+name+']')).to_have_class('active')
    for name in ['library','stats','friends']:
        page.go_forward();expect(page).to_have_url(__import__('re').compile('#'+name))
    length=page.evaluate('history.length');page.locator('.sidebar-links [data-action=friends]').click();assert page.evaluate('history.length')==length
    page.locator('.sidebar-links [data-action=home]').click();page.locator('[data-action=mode-daily]').click();expect(page).to_have_url(__import__('re').compile('mode=daily'))
    page.locator('.category-card[data-action="play:screenshot"]').click();expect(page).to_have_url(__import__('re').compile('#game/screenshot'))
    page.locator('[data-action=giveup]').click();saved=page.evaluate("localStorage.getItem('aniloop-state-v1')")
    page.locator('.sidebar-links [data-action=stats]').click();page.go_back();expect(page.locator('.game-heading')).to_be_visible();assert page.evaluate("localStorage.getItem('aniloop-state-v1')")==saved
    page.reload();expect(page.locator('.game-heading')).to_be_visible();expect(page).to_have_url(__import__('re').compile('mode=daily'))
    # Help is a history entry, including browser back, forward, close and Escape.
    page.locator('.sidebar-links [data-action=help]').click();expect(page.locator('dialog')).to_be_visible();expect(page).to_have_url(__import__('re').compile('#help'))
    page.go_back();expect(page.locator('dialog')).not_to_be_visible();expect(page.locator('.game-heading')).to_be_visible()
    page.go_forward();expect(page.locator('dialog')).to_be_visible();page.keyboard.press('Escape');expect(page.locator('dialog')).not_to_be_visible();expect(page).to_have_url(__import__('re').compile('#game/screenshot'))
    page.locator('.policy-footer-links [data-action=privacy]').click();page.locator('.policy-nav [data-action=cookies]').click();page.go_back();expect(page.locator('main h1')).to_have_text('Privacy policy')
    # Mode restores, but game answers and scores do not rewind.
    page.locator('.sidebar-links [data-action=home]').click();page.locator('[data-action=mode-infinity]').click();page.go_back();expect(page).to_have_url(__import__('re').compile('mode=daily'))
    assert page.evaluate("JSON.parse(localStorage.getItem('aniloop-state-v1')).daily.games.screenshot.scores")==[0]
    assert not errors,errors;browser.close();print('PASS: real Back/Forward across top-bar/policy/help routes, no duplicate entries, category/mode deep-link reload, Escape, and no score/save rollback')
