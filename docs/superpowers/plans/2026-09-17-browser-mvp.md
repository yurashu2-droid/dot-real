# Browser MVP Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a runnable camera-to-pixel-art browser MVP to dot-real.
**Architecture:** Native ES modules separate pure mask/color/tracking code from camera lifecycle, worker inference and UI. One synchronized processed frame is displayed at a time when a target is selected.
**Tech Stack:** JavaScript, Canvas 2D, MediaPipe v0.10.21, Web Workers, Node 22 tests; Python Playwright for browser smoke verification.
**Spec:** docs/superpowers/specs/2026-09-17-browser-mvp-design.md

## Global Constraints
- No camera/video uploads or analytics.
- All asset URLs pinned to specific versions; no `latest`.
- One tracked target; stop on loss, require reselection.
- AI mode, rectangular manual mode and synthetic demo must remain distinct.
- Camera requires HTTPS or localhost; mobile physical-device testing reported separately.

### Task 1: Pure image and motion core
Files: src/core/{geometry,mask,pixel,tracker}.js, tests/core.test.js.
Interfaces: normalized points; masks are Uint8Array with row-major width*height entries; transformations are {a,b,tx,ty}; RGBA is Uint8ClampedArray.
- [x] Write failing tests: `mapPointer(50,50,{left:0,top:0,width:100,height:100},200,100)` equals `{x:0.5,y:0.5}`; letterboxes return null; connected components isolate the clicked object; pixelation preserves unselected background; actual textured frames translate by known amounts.
- [x] Run `npm test`, observe missing implementation failures.
- [x] Implement pure functions and PatchTracker; run the same tests until passing.
- [x] Commit core with tests.

### Task 2: Camera and worker lifecycle
Files: src/camera.js, src/vision/{assets,segmenter,pipeline,worker}.js, tests/lifecycle.test.js.
Interfaces: CameraController.start(facing) / stop(); worker messages init/load-ai/frame/clear; responses ready/model/result/error with session identifiers.
- [x] Test delayed permission resolution after stop; stop every track; deny insecure origins before acquisition.
- [x] Implement camera lifecycle, CPU MediaPipe adapter, mask copying inside callback, one-frame worker processing and manual path.
- [x] Test lifecycle and mask adapter; syntax-check all modules with `node --check`.

### Task 3: Product UI and offline demo
Files: index.html, styles.css, src/{app,demo}.js, src/ui/renderer.js, assets/icon.svg, tests/browser_smoke.py.
- [x] Write browser acceptance tests for visible heading, demo selection/clear, fixed palettes, export, stop and permission denial.
- [x] Implement responsive camera UI and explicit synthetic demo using the real tracker and renderer after initial known-mask selection.
- [x] Run browser acceptance with an offline inline harness because managed policy blocks URL navigation; inspect mobile/desktop screenshots. The standard HTTP test is included for CI.

### Task 4: Delivery and verification
Files: scripts/{serve,build,vendor}.mjs, README.md, THIRD_PARTY_NOTICES.md, .github/workflows/{ci,pages}.yml, docs/verification.md.
- [x] Build static output with `npm run build` and serve it via `npm run preview`.
- [x] Run fresh unit tests, browser smoke and syntax checks; record exact evidence and remaining device/model tests.
- [ ] Push verified source to feat/browser-mvp using GitHub tools, create a PR, and verify the remote tree.
