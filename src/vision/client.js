/** Owns the worker, one in-flight frame, and stale-selection rejection. */
export class VisionClient {
  constructor({onReady,onFrame,onModel,onError}) {
    this.ready=false;this.busy=false;this.closed=false;this.epoch=0;this.serial=0;
    this.worker=new Worker(new URL('./worker.js',import.meta.url));
    this.bootTimer=setTimeout(()=>this.fail('画像処理を開始できませんでした。ページを再読み込みしてください。',onError),15000);
    this.worker.onerror=()=>this.fail('このブラウザでは画像処理を開始できません。Safari / Chromeでお試しください。',onError);
    this.worker.onmessage=({data})=>{
      if(this.closed){data.bitmap?.close();data.original?.close();return;}
      if(data.type==='ready'){clearTimeout(this.bootTimer);this.ready=true;onReady();}
      else if(data.type==='model'){if(data.state!=='loading')clearTimeout(this.modelTimer);onModel(data);}
      else if(data.type==='result'||data.type==='frame-error'){
        clearTimeout(this.frameTimer);this.busy=false;
        if(data.id?.epoch!==this.epoch){data.bitmap?.close();data.original?.close();return;}
        if(data.type==='frame-error'){onError(data.message);return;}onFrame(data);
      }else if(data.type==='fatal')this.fail(data.message,onError);
    };
    this.onModel=onModel;
  }
  loadAI(){if(this.closed)return;clearTimeout(this.modelTimer);this.onModel({state:'loading',detail:'AIを準備しています。枠での選択も利用できます。'});this.modelTimer=setTimeout(()=>this.onModel({state:'error',detail:'AIの読込に時間がかかっています。通信を確認するか「枠で選ぶ」をお使いください。'}),60000);this.worker.postMessage({type:'load-ai'});}
  send(bitmap,selection,style,onError){
    if(!this.ready||this.busy||this.closed){bitmap.close();return false;}
    this.busy=true;const id={request:++this.serial,epoch:this.epoch};
    const transfer=[bitmap];if(selection?.mask instanceof Uint8Array)transfer.push(selection.mask.buffer);
    this.frameTimer=setTimeout(()=>this.fail('画像処理が応答しませんでした。カメラを再開してください。',onError),15000);
    this.worker.postMessage({type:'frame',id,bitmap,selection,style},transfer);return true;
  }
  clear(){this.epoch++;if(!this.closed)this.worker.postMessage({type:'clear'});}
  fail(message,onError){if(this.closed)return;this.close();onError(message);}
  close(){this.closed=true;this.ready=false;this.busy=false;clearTimeout(this.bootTimer);clearTimeout(this.modelTimer);clearTimeout(this.frameTimer);this.worker.terminate();}
}
