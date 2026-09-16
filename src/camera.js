/** Owns the camera, including a getUserMedia request that resolves after Stop. */
export class CameraController {
  constructor(video, mediaDevices = globalThis.navigator?.mediaDevices, secure = globalThis.isSecureContext) {
    this.video = video; this.mediaDevices = mediaDevices; this.secure = secure; this.generation = 0; this.stream = null;
  }
  async start(facing = 'environment') {
    this.stop(); const generation = this.generation;
    if (!this.secure) throw new Error('カメラを使うには HTTPS または localhost で開いてください');
    if (!this.mediaDevices?.getUserMedia) throw new Error('このブラウザではカメラを利用できません。Safari / Chrome で開いてください');
    const stream = await this.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 960 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } } });
    if (generation !== this.generation) { stream.getTracks().forEach(t => t.stop()); return null; }
    this.stream = stream; this.video.srcObject = stream;
    try { await this.video.play(); }
    catch (error) { if (generation === this.generation) this.stop(); throw error; }
    return generation === this.generation ? stream : null;
  }
  stop() {
    this.generation++; this.stream?.getTracks().forEach(track => track.stop()); this.stream = null;
    this.video.pause(); this.video.srcObject = null;
  }
}

export function cameraError(error) {
  const messages = {
    NotAllowedError: 'カメラが許可されていません。ブラウザのサイト設定で許可して、再度お試しください。',
    NotFoundError: 'カメラが見つかりません。デモモードでも体験できます。',
    NotReadableError: '別のアプリがカメラを使用している可能性があります。閉じてから再度お試しください。',
    OverconstrainedError: 'このカメラでは指定した映像を取得できません。別のカメラでお試しください。',
    SecurityError: 'ブラウザのセキュリティ設定でカメラが制限されています。',
  };
  return messages[error?.name] || error?.message || 'カメラを開始できませんでした。';
}
