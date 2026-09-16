# Verification record — 2026-09-17

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

## Not verified in the local environment

- Real MediaPipe runtime/model download and actual inference: external network unavailable. `tests/ai_smoke.py` and a separate CI step are supplied to test these without substituting demo/manual masks.
- Standard HTTP-served `tests/browser_smoke.py`: local browser navigation is administratively blocked. GitHub CI runs the normal URL path.
- Physical iPhone/Android camera, Safari-specific behavior, heat/battery, natural-image segmentation accuracy, and real-device throughput.
- Public deployment/HTTPS endpoint: requires a successful hosting deployment, not just repository files.

## Reproduce / inspect remote evidence

The `Verify MVP` workflow uses Node 22 + Playwright Chromium. It first runs unit tests and offline browser acceptance, then downloads pinned assets and runs **real MediaPipe inference** on the original rocket drawing. A passed real-model smoke establishes loader/API compatibility and a nontrivial mask; it does not prove segmentation quality on all real-world objects. Inspect the workflow run for the exact commit and `verification-evidence` artifacts. Never infer a pass merely from the presence of the workflow file.

Review was performed inline against the scope and source. No independent reviewer agent was available; no independent review is claimed.
