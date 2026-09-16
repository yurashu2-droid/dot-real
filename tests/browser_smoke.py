"""Offline browser acceptance. Real model inference has a separate opt-in test.
Run: python tests/browser_smoke.py --url http://127.0.0.1:5173
Requires: pip install playwright; python -m playwright install chromium
"""
import argparse, os, pathlib, shutil
from playwright.sync_api import sync_playwright, expect

parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:5173');args=parser.parse_args()
output=pathlib.Path('test-results');output.mkdir(exist_ok=True)
with sync_playwright() as p:
    options={'headless':True,'args':['--no-sandbox']}
    if os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'):
        options['executable_path']=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
    browser=p.chromium.launch(**options)
    context=browser.new_context(viewport={'width':1440,'height':1050},accept_downloads=True)
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(args.url);expect(page.locator('h1')).to_be_visible(timeout=5000)
    page.screenshot(path=str(output/'desktop-start.png'),full_page=True)
    page.locator('#demo-start').click()
    expect(page.locator('#status-detail')).to_contain_text('DEMO ·')
    page.evaluate('''() => {window.originalCreateImageBitmap=window.createImageBitmap;window.createImageBitmap=async (...args)=>{await new Promise(r=>setTimeout(r,200));return window.originalCreateImageBitmap(...args);};}''')
    page.locator('#preview').focus();page.keyboard.press('Space');page.wait_for_timeout(60);page.keyboard.press('Escape');page.wait_for_timeout(450)
    expect(page.locator('#preview')).to_have_attribute('data-selected','false')
    page.evaluate('() => {window.createImageBitmap=window.originalCreateImageBitmap;}')
    page.locator('#preview').focus();page.keyboard.press('Space')
    expect(page.locator('#preview')).to_have_attribute('data-selected','true',timeout=10000)
    page.wait_for_timeout(1400)
    expect(page.locator('#preview')).to_have_attribute('data-selected','true')
    page.locator('[data-palette="gameboy"]').click()
    expect(page.locator('[data-palette="gameboy"]')).to_have_attribute('aria-pressed','true')
    page.wait_for_timeout(350)
    # Verify real renderer output, not only selected button CSS.
    count=page.evaluate('''() => {const c=document.querySelector('#preview'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if((d[i]===155&&d[i+1]===188&&d[i+2]===15)||(d[i]===48&&d[i+1]===98&&d[i+2]===48))n++;return n;}''')
    assert count>100, f'No pixel-art palette visible: {count}'
    page.screenshot(path=str(output/'desktop-tracking.png'),full_page=True)
    with page.expect_download() as download:
        page.locator('#save').click()
    download.value.save_as(str(output/'snapshot.png'))
    assert (output/'snapshot.png').read_bytes()[:8]==b'\x89PNG\r\n\x1a\n'
    page.locator('#clear').click();page.wait_for_timeout(300)
    expect(page.locator('#preview')).to_have_attribute('data-selected','false')
    page.locator('#stop').click();expect(page.locator('#source-label')).to_contain_text('READY')
    page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(output/'mobile-start.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Horizontal overflow on mobile'
    page.locator('#demo-start').click();expect(page.locator('#status-detail')).to_contain_text('DEMO ·');page.locator('#preview').focus();page.keyboard.press('Space')
    expect(page.locator('#preview')).to_have_attribute('data-selected','true',timeout=10000)
    page.screenshot(path=str(output/'mobile-tracking.png'),full_page=True)
    page.locator('#stop').click()
    page.add_init_script("Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{throw new DOMException('denied','NotAllowedError')}}});")
    page.reload();page.locator('#camera-start').click()
    expect(page.locator('#error-message')).to_contain_text('許可',timeout=8000)
    expect(page.locator('#source-label')).to_contain_text('READY')
    assert not errors, errors
    context.close();browser.close()
print('PASS: desktop/mobile layout, real demo tracking, palette rendering, PNG export, stale-result clear, stop, denied-camera error; no page exceptions.')
