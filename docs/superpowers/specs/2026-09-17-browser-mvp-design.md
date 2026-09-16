# dot-real: Browser MVP design

## User-approved product scope
The conversation specifies a browser camera: tap one physical object, replace only that object with a pixel-art effect, and follow modest movement. The user authorized implementation in this new repository and requested a completed MVP. No accounts, backend, video upload, 3D reconstruction, or payment is needed.

## Architecture decision
Use native browser ES modules, a classic dedicated worker with dynamic imports, MediaPipe InteractiveSegmenter v0.10.21 / MagicTouch v1, an original small patch-based motion tracker, and Canvas 2D. Native Node scripts provide development, build, and unit testing without an install step. A heavy SAM2/WebGPU stack was considered but rejected for this initial mobile-first prototype. OpenCV.js was considered but a focused, testable tracker avoids another large runtime download. Model and runtime versions are pinned; no floating `latest` URLs.

## Experience
Japanese UI; camera with explicit permission; tap-to-select AI mode; explicitly labeled rectangular manual selection when AI cannot load; visibly labeled offline synthetic demo; four fixed palettes; pixel-size control; optional outline; hold-to-compare; PNG download; clear, switch camera, and stop controls. Camera frames are processed on device. Only runtime/model downloads contact external providers. No analytics.

## Processing contract
Resize incoming frames to at most 480 px on the long edge. One frame in flight. Initialize a foreground mask with MagicTouch or explicit manual selection. Track image features with coarse-to-fine patch matching, reject inconsistent matches, fit a similarity transform, warp the previous mask, and periodically re-segment a predicted interior point for AI selections. Reject large mask jumps. Render the mask on its corresponding frame, not on a newer live frame. Stop the effect on lost tracking, rather than pretending a different object is the selected object. No promise of re-identification after occlusion or leaving the frame.

## Lifecycle and errors
HTTPS or localhost required for camera. Check mediaDevices, WebAssembly, OffscreenCanvas, Worker and createImageBitmap. Denied permission, missing device, busy device, unsupported browser, model network errors, worker timeout, empty mask, and tracking loss must have actionable Japanese messages. Ignore stale async camera acquisitions; close tracks and bitmaps on source changes, Stop, hidden tab and page exit. Runtime/model downloads are optional for demo and manual selection. No automatic full-frame fallback presented as AI.

## Acceptance
Unit tests for coordinates, masks, foreground-only colors, transformation fitting, actual synthetic-frame tracking, tracking loss and camera lifecycle. Browser tests for startup, offline demo, palette control, selection/clear, export and graceful camera errors. Build and syntax checks. Real MediaPipe inference and physical iOS/Android camera performance are separate verification items; do not claim these are tested without actually running them.
