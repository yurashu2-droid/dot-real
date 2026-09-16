"""Real pinned MediaPipe inference in the actual classic worker. Network/setup required.
Run npm run vendor first, then serve the project and run python tests/ai_smoke.py.
The image is our synthetic scene, but the segmentation comes from the REAL model.
This does not replace physical phone/camera or natural-image accuracy testing.
"""
import argparse, json, os, pathlib, shutil
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:5173');args=parser.parse_args()
with sync_playwright() as p:
    options={'headless':True,'args':['--no-sandbox']}
    if os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'):
        options['executable_path']=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
    browser=p.chromium.launch(**options);page=browser.new_page();page.goto(args.url)
    result=page.evaluate('''async () => {
      const {drawDemo}=await import('./src/demo.js');
      const canvas=document.createElement('canvas');canvas.width=480;canvas.height=360;
      const point=drawDemo(canvas,0), worker=new Worker(new URL('./src/vision/worker.js',location.href));
      return await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{worker.terminate();reject(new Error('Real model test timed out'));},120000);
        const fail=message=>{clearTimeout(timer);worker.terminate();reject(new Error(message));};
        worker.onerror=e=>fail(e.message);
        worker.onmessage=async ({data})=>{
          if(data.type==='ready')worker.postMessage({type:'load-ai'});
          if(data.type==='model' && data.state==='error')fail(data.detail);
          if(data.type==='model' && data.state==='ready'){
            const bitmap=await createImageBitmap(canvas);
            worker.postMessage({type:'frame',id:{request:1,epoch:0},bitmap,selection:{kind:'ai',point},style:{palette:'gameboy',blockSize:10,outline:true}},[bitmap]);
          }
          if(data.type==='fatal'||data.type==='frame-error')fail(data.message);
          if(data.type==='result'){
            const output=document.querySelector('#preview');output.width=480;output.height=360;
            output.getContext('2d').drawImage(data.bitmap,0,0);data.bitmap.close();data.original.close();
            clearTimeout(timer);worker.terminate();resolve({state:data.state,box:data.box,milliseconds:data.milliseconds,message:data.message});
          }
        };
      });
    }''')
    print(json.dumps(result,ensure_ascii=False))
    assert result['state']=='selected',f'Real model failed to select target: {result}'
    assert 100 < result['box']['area'] < 480*360*.88,result
    out=pathlib.Path('test-results');out.mkdir(exist_ok=True)
    (out/'real-ai.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    # The app is idle during this isolated worker test; remove its start overlay.
    page.evaluate("document.getElementById('intro').hidden = true")
    page.locator('#preview').screenshot(path=str(out/'real-ai.png'))
    browser.close()
print('PASS: real MediaPipe model initialized and produced a nontrivial object mask through the production worker.')
