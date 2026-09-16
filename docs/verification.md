# Verification record — 2026-09-17

## GitHub Actions — actual execution passed

The full **Verify MVP** run completed successfully, including real model inference:

- Run: https://github.com/yurashu2-droid/dot-real/actions/runs/35120222664
- Application commit: `bbdeac6e35b4ef43e581352b08cbd6a01331b250`
- Source tree: `c34b26dbd30a007848e66ee4f0b56cb8da09d520` (byte-for-byte equal to the locally tested tree)
- Node 22.23.2: **29 tests passed / 0 failed**, build and syntax checks passed.
- Standard HTTP delivery in Chromium: desktop/mobile layout, actual image tracking, rendered palette pixels, PNG export, stale selection rejection, Stop, and camera-permission denial all passed without page exceptions.
- Pinned MediaPipe JS/WASM/model/license download: passed.
- **Real MediaPipe inference through the production worker: passed.** A generated rocket image was supplied to the model with a point prompt. The model returned a 8,471-pixel foreground component at `{x:200,y:100,width:99,height:153}`. This test did not supply the demo's known mask to the model or processor.
- Artifact: `verification-evidence`, ID `10456108757`, includes screenshots, PNG export, real inference JSON, and server logs.

This establishes runtime/API compatibility and successful segmentation of the test image, not accuracy on all real-world objects or performance on a phone. The independent demo tests still use a known initial silhouette; they are not evidence of AI inference.

## Local execution evidence

- Node 22.16.0, native Node test runner: **29 tests passed / 0 failed**.
- `npm run build`: passed; native ES modules copied to `dist/`.
- `node --check` over source/build scripts: passed.
- Python browser-test files compile successfully.
- Chromium desktop (1440×1050) and mobile-size (390×844) acceptance: passed using an offline inline test harness. The environment blocks browser URL navigation by managed policy and cannot reach external hosts, so source modules were transformed for an in-memory page and the real worker was supplied as a Blob. No browser policies were changed. This is not evidence of the normal HTTP delivery path or real MediaPipe inference.
- Verified real synthetic-frame tracking, palette pixels in the rendered image, selection retention, selection clearing, PNG file signature, Stop, mobile overflow, and insecure-origin error. No uncaught page errors.
- Found and reproduced a stale-capture regression: Escape during pending `createImageBitmap()` could restore the old selection. Added a selection generation guard and reran the regression successfully.
- Found and fixed a staging-path bug in optional asset preparation; successful publication and preservation of old assets on download failure are regression-tested.
- Synthetic demo receives its initial silhouette from its own drawing, **not AI**. Later frames go through the production image tracker.

## Local limitations (resolved by remote CI where noted)

- Real MediaPipe runtime/model download and actual inference: external network unavailable. **Subsequently passed in GitHub Actions**, as recorded above.
- Standard HTTP-served `tests/browser_smoke.py`: local browser navigation is administratively blocked. **The normal URL path subsequently passed in GitHub Actions.**
- Physical iPhone/Android camera, Safari-specific behavior, heat/battery, natural-image segmentation accuracy, and real-device throughput.
- Public deployment/HTTPS endpoint: requires a successful hosting deployment, not just repository files.

## Reproduce / inspect remote evidence

The `Verify MVP` workflow uses Node 22 + Playwright Chromium. It first runs unit tests and offline browser acceptance, then downloads pinned assets and runs **real MediaPipe inference** on the original rocket drawing. A passed real-model smoke establishes loader/API compatibility and a nontrivial mask; it does not prove segmentation quality on all real-world objects. Inspect the workflow run for the exact commit and `verification-evidence` artifacts. Never infer a pass merely from the presence of the workflow file.

Review was performed inline against the scope and source. No independent reviewer agent was available; no independent review is claimed.
