"""Touch-only playthrough from creation to Mira, with process-independent saved state."""
from pathlib import Path
import argparse
import subprocess
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright, expect

def run(url, chromium, snapshot=None):
    with sync_playwright() as p, TemporaryDirectory() as profile:
        def launch():
            return p.chromium.launch_persistent_context(profile,executable_path=chromium,
                args=['--no-sandbox'],viewport={'width':393,'height':830},is_mobile=True,has_touch=True)
        browser=launch()
        page=browser.new_page()
        errors=[]
        page.on('pageerror',lambda exc:errors.append(str(exc)))
        page.goto(url)
        page.get_by_label('Chosen name').fill('Moth')
        page.get_by_label('Chassis finish').select_option('Slate')
        def tap(label):page.get_by_role('button',name=label,exact=True).tap()
        def move(path):
            for d in path:tap('Move '+dict(R='east',U='north',L='west',D='south')[d])
        tap('Awaken')
        move('UUU');tap('Listen');move('DDRRRR');tap('Fit legacy bearing');move('R');tap('Equip arc blade')
        move('DRRRU');move('RRR')
        expect(page.locator('#place')).to_have_text('Relay gallery')
        move('RRRUUU');tap('Ask to travel together');move('DDRRRR')
        tap('Engage')
        tap('Pulse · 1 charge')
        expect(page.locator('#mode')).to_have_text('Turn 2')
        browser.close()
        browser=launch();page=browser.new_page();page.on('pageerror',lambda exc:errors.append(str(exc)));page.goto(url)
        expect(page.locator('#mode')).to_have_text('Turn 2')
        tap('Strike')
        expect(page.locator('#place')).to_have_text('Relay gallery')
        move('RRRRR')
        expect(page.locator('#place')).to_have_text('Sounding ridge')
        move('RRUUU');tap('Request escort')
        move('DDRRRRRR')
        tap('Keep your name private')
        expect(page.locator('#mode')).to_have_text('Survey complete')
        expect(page.locator('#objective')).to_contain_text('Echo ally · Crawler escort')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        if snapshot:page.screenshot(path=snapshot)
        assert not errors,errors
        browser.close()
        print('PASS touch playthrough, recruits, battle relaunch, private ending, phone width')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--chromium',default='/usr/bin/chromium')
    p.add_argument('--url',default=(Path(__file__).resolve().parents[1]/'game/index.html').as_uri())
    p.add_argument('--snapshot');a=p.parse_args();run(a.url,a.chromium,a.snapshot)
