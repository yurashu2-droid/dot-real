import { CameraController, cameraError } from './camera.js';
import { fitSize, mapPointer } from './core/geometry.js';
import { drawDemo, demoMask } from './demo.js';
import { PreviewRenderer } from './ui/renderer.js';
import { VisionClient } from './vision/client.js';

const $ = id => document.getElementById(id);
const preview = $('preview'), video = $('camera-video');
const renderer = new PreviewRenderer(preview, $('overlay'));
const camera = new CameraController(video);
const input = document.createElement('canvas'); input.width = 480; input.height = 360;
const inputContext = input.getContext('2d', { willReadFrequently: true });
const style = { blockSize: 10, palette: 'color', outline: true };
let source = 'idle', mode = 'ai', facing = 'environment', selected = false;
let client = null, selectionEpoch = 0, session = 0, frameRequest = 0, pendingSelection = null, capturing = false;
let demoStart = 0, demoTime = 0, demoPoint = { x: .52, y: .49 }, drag = null;
let modelState = 'idle', modelDetail = '', toastTimer, frameCount = 0, fpsStart = 0, lastCapture = 0;

function notify(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 3500); }
function error(message) { $('error-message').textContent = message; $('error').hidden = false; }
function setSelected(value) {
  selected = value; preview.dataset.selected = String(value); $('clear').disabled = !value; $('compare').disabled = !value;
  if (!value) setComparison(false);
}
function setComparison(value) { renderer.setComparison(value && selected); $('compare').setAttribute('aria-pressed', String(value && selected)); }
function updateHint(message) {
  $('hint').textContent = message || (source === 'demo' ? '動くロケットをタップして、ドットに。' : mode === 'manual' ? '対象をドラッグで囲んでください' : 'ドットにしたい物体の中央をタップ');
}
function updateModel() {
  const text = source === 'demo' ? 'デモは合成シーンです。AIは使用しません。' : mode === 'manual' ? '囲んだ四角い領域を加工します。AIは不要です。' : modelState === 'ready' ? 'AI READY · 物体の中央をタップしてください。' : modelState === 'loading' ? modelDetail : modelState === 'error' ? 'AIを読み込めませんでした。「枠で選ぶ」も利用できます。' : 'カメラ起動時にAIを読み込みます。';
  $('model-status').textContent = text; $('model-status').title = modelState === 'error' ? modelDetail : '';
  $('retry-ai').hidden = source !== 'camera' || mode !== 'ai' || modelState !== 'error';
}
function clearSelection(showHint = true) {
  selectionEpoch++; pendingSelection = null; drag = null; client?.clear(); setSelected(false); renderer.clear();
  $('track-state').textContent = 'SELECT A TARGET'; $('fps').textContent = '—'; frameCount = 0;
  if (showHint) updateHint();
}
function stop(showToast = false) {
  session++; cancelAnimationFrame(frameRequest); client?.close(); client = null; camera.stop(); renderer.clear();
  capturing = false; pendingSelection = null; drag = null; source = 'idle'; modelState = 'idle'; setSelected(false);
  $('intro').hidden = false; $('starting').hidden = true; $('live-top').hidden = true; $('hint').hidden = true;
  $('source-label').textContent = 'READY TO EXPLORE'; $('status-detail').textContent = '01 カメラを開く。気になるものを選ぶ。';
  $('stop').disabled = true; $('flip').disabled = true; $('save').disabled = true; $('fps').textContent = '—'; preview.tabIndex = -1;
  input.width = 480; input.height = 360; drawDemo(input, 0); renderer.live(input); updateModel();
  if (showToast) notify('カメラと画像処理を停止しました');
}
function fatal(message) { stop(); error(message); }
function requestModel() {
  if (source !== 'camera' || mode !== 'ai' || !client || modelState === 'ready' || modelState === 'loading') return;
  modelState = 'loading'; updateModel(); client.loadAI();
}
async function start(kind) {
  stop(); const token = session; $('error').hidden = true;
  if (!globalThis.Worker || !globalThis.OffscreenCanvas || !globalThis.createImageBitmap) { error('このブラウザは画像処理に対応していません。新しいSafari / Chromeで開いてください。'); return; }
  clearTimeout(toastTimer); $('toast').hidden = true;
  source = 'starting'; $('stop').disabled = false; $('intro').hidden = true; $('starting').hidden = kind === 'demo';
  try {
    if (kind === 'camera') { const stream = await camera.start(facing); if (!stream || token !== session) return; }
    if (token !== session) return;
    source = kind; modelState = 'idle'; demoStart = performance.now(); fpsStart = demoStart; frameCount = 0; lastCapture = 0;
    client = new VisionClient({
      onReady: () => { if (token !== session) return; $('status-detail').textContent = source === 'demo' ? 'DEMO · 既知の輪郭＋画像からの追従' : 'LIVE · 映像は端末内で処理されます'; },
      onModel: data => { if (token !== session) return; modelState = data.state; modelDetail = data.detail; updateModel(); },
      onFrame: data => {
        if (token !== session) { data.bitmap.close(); data.original.close(); return; }
        if (data.state === 'lost') {
          data.bitmap.close(); data.original.close(); renderer.clear(); setSelected(false); $('track-state').textContent = 'TARGET LOST'; updateHint(data.message); $('status-detail').textContent = '対象を再選択してください'; return;
        }
        const active = data.state === 'selected' || data.state === 'tracking';
        renderer.frame(data.bitmap, data.original, data.box); setSelected(active);
        if (active) { $('track-state').textContent = '● TRACKING'; updateHint('動かしてみよう。選んだ部分だけ、ドットのまま。'); }
        frameCount++; const elapsed = performance.now() - fpsStart;
        if (elapsed >= 800) { $('fps').textContent = (frameCount * 1000 / elapsed).toFixed(0); frameCount = 0; fpsStart = performance.now(); }
        $('status-detail').textContent = `${source === 'demo' ? 'DEMO' : mode === 'manual' ? 'MANUAL' : 'AI'} · ${Math.round(data.milliseconds)} ms / frame`;
      },
      onError: message => { if (token === session) fatal(message); },
    });
    $('starting').hidden = true; $('intro').hidden = true; $('live-top').hidden = false; $('hint').hidden = false;
    $('source-label').textContent = kind === 'demo' ? '● DEMO / SYNTHETIC SCENE' : '● CAMERA / ON DEVICE';
    $('demo-label').hidden = kind !== 'demo'; $('flip').disabled = kind !== 'camera'; $('save').disabled = false; preview.tabIndex = 0;
    updateHint(); updateModel(); requestModel(); frameRequest = requestAnimationFrame(loop);
  } catch (e) { if (token === session) { stop(); error(cameraError(e)); } }
}
function loop(time) {
  if (source !== 'camera' && source !== 'demo') return;
  frameRequest = requestAnimationFrame(loop);
  if (source === 'camera') {
    if (video.readyState < 2 || !video.videoWidth) return;
    const { width, height } = fitSize(video.videoWidth, video.videoHeight, 480);
    if (input.width !== width || input.height !== height) { input.width = width; input.height = height; }
    inputContext.drawImage(video, 0, 0, input.width, input.height);
  } else { demoTime = time - demoStart; demoPoint = drawDemo(input, demoTime); }
  if (!selected) renderer.live(input);
  if (drag) renderer.rectangle(drag.from, drag.to);
  if ((!selected && !pendingSelection) || !client?.ready || client.busy || capturing || time - lastCapture < 50) return;
  let selection = pendingSelection;
  if (selection?.kind === 'demo') {
    const mask = demoMask(input.width, input.height, demoTime);
    const p = selection.point, x = Math.min(input.width - 1, Math.floor(p.x * input.width)), y = Math.min(input.height - 1, Math.floor(p.y * input.height));
    if (!mask[y * input.width + x]) { pendingSelection = null; updateHint('デモでは中央のロケットを選んでください'); return; }
    selection = { kind: 'demo', mask };
  }
  pendingSelection = null; capturing = true; lastCapture = time;
  const token = session, epoch = selectionEpoch, currentClient = client;
  createImageBitmap(input).then(bitmap => {
    if (token !== session || epoch !== selectionEpoch || client !== currentClient) { bitmap.close(); return; }
    currentClient.send(bitmap, selection, { ...style }, fatal);
  }).catch(e => { if (token === session) fatal(`映像を処理できませんでした: ${e.message}`); }).finally(() => { if (token === session) capturing = false; });
}
function choose(point, rectangle) {
  if ((source !== 'camera' && source !== 'demo') || !client?.ready) return;
  if (source === 'camera' && mode === 'ai' && modelState !== 'ready') { updateHint('AIを準備中です。「枠で選ぶ」ならすぐに試せます。'); requestModel(); return; }
  clearSelection(false);
  pendingSelection = source === 'demo' ? { kind: 'demo', point } : mode === 'manual' ? { kind: 'manual', from: rectangle.from, to: rectangle.to } : { kind: 'ai', point };
  $('track-state').textContent = 'SELECTING…'; updateHint('対象を選んでいます');
}
const pointer = event => mapPointer(event.clientX, event.clientY, preview.getBoundingClientRect(), preview.width, preview.height);
preview.addEventListener('pointerdown', event => {
  if (source !== 'camera' && source !== 'demo') return;
  const point = pointer(event); if (!point) return;
  preview.setPointerCapture(event.pointerId);
  if (source === 'camera' && mode === 'manual') drag = { from: point, to: point };
});
preview.addEventListener('pointermove', event => { if (drag) { const point = pointer(event); if (point) drag.to = point; } });
preview.addEventListener('pointerup', event => {
  const point = pointer(event);
  if (drag) { const rectangle = drag; drag = null; if (Math.abs(rectangle.to.x - rectangle.from.x) < .03 || Math.abs(rectangle.to.y - rectangle.from.y) < .03) { updateHint('タップではなく、対象をドラッグで囲んでください'); return; } choose(point, rectangle); }
  else if (point) choose(point);
});
preview.addEventListener('pointercancel', () => { drag = null; renderer.draw(); });
preview.addEventListener('keydown', event => {
  if (event.code === 'Space' || event.code === 'Enter') { event.preventDefault(); choose(source === 'demo' ? demoPoint : { x: .5, y: .5 }, { from: { x: .3, y: .25 }, to: { x: .7, y: .75 } }); }
});
$('camera-start').addEventListener('click', () => start('camera'));
$('demo-start').addEventListener('click', () => start('demo'));
$('stop').addEventListener('click', () => stop(true));
$('clear').addEventListener('click', () => clearSelection());
$('flip').addEventListener('click', () => { facing = facing === 'environment' ? 'user' : 'environment'; start('camera'); });
$('retry-ai').addEventListener('click', () => { modelState = 'error'; requestModel(); });
$('dismiss-error').addEventListener('click', () => $('error').hidden = true);
for (const radio of document.querySelectorAll('input[name=mode]')) radio.addEventListener('change', () => { mode = radio.value; clearSelection(); updateModel(); requestModel(); });
for (const button of document.querySelectorAll('[data-palette]')) button.addEventListener('click', () => {
  style.palette = button.dataset.palette;
  for (const other of document.querySelectorAll('[data-palette]')) other.setAttribute('aria-pressed', String(other === button));
});
$('block-size').addEventListener('input', () => { style.blockSize = Number($('block-size').value); $('block-value').textContent = `${style.blockSize} PX`; });
$('outline').addEventListener('change', () => style.outline = $('outline').checked);
$('save').addEventListener('click', async () => {
  try { const blob = await renderer.blob(), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `dot-real-${new Date().toISOString().replace(/[:.]/g, '-')}.png`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); notify('PNG画像を保存しました'); }
  catch (e) { error(e.message); }
});
const compare = $('compare');
compare.addEventListener('pointerdown', event => { if (compare.disabled) return; compare.setPointerCapture(event.pointerId); setComparison(true); });
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) compare.addEventListener(name, () => setComparison(false));
compare.addEventListener('keydown', event => { if (event.code === 'Space' || event.code === 'Enter') { event.preventDefault(); setComparison(true); } });
compare.addEventListener('keyup', () => setComparison(false));
compare.addEventListener('contextmenu', event => event.preventDefault());
$('help').addEventListener('click', () => $('help-dialog').showModal());
$('help-close').addEventListener('click', () => $('help-dialog').close());
window.addEventListener('keydown', event => { if (event.code === 'Escape' && !$('help-dialog').open) clearSelection(); });
window.addEventListener('blur', () => setComparison(false));
document.addEventListener('visibilitychange', () => { if (document.hidden && source !== 'idle') stop(); });
window.addEventListener('pagehide', () => stop());
stop();
