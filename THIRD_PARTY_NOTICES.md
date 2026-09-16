# Third-party notices

## MediaPipe Tasks Vision / MagicTouch

The optional AI selection mode uses Google MediaPipe Tasks Vision **0.10.21** and the **MagicTouch float32 model, version 1**. CPU/WebAssembly inference happens in a dedicated browser worker. These are not bundled into the source by default.

- Project: https://github.com/google-ai-edge/mediapipe/tree/v0.10.21
- Source license: Apache License 2.0, Copyright The MediaPipe Authors.
- License: https://github.com/google-ai-edge/mediapipe/blob/v0.10.21/LICENSE
- Task/model documentation: https://ai.google.dev/edge/mediapipe/solutions/vision/interactive_segmenter
- Model asset: https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite
- The model is published by Google; retain its applicable model notices and review the linked model card/terms before redistributing or using the model commercially. The source-code license alone should not be treated as a substitute for model terms.

The application can download these pinned assets from jsDelivr and Google Cloud Storage. `npm run vendor` instead downloads a matching local set and preserves the MediaPipe license. No image frames are sent with these requests. Ordinary asset requests expose network metadata (such as IP address) to their hosts.

## Original application components

The UI, synthetic rocket scene, fixed color tables, connected-component masks, patch tracker, and rendering pipeline in this repository are original implementation code. The tracker uses standard image-processing techniques (image pyramids, normalized patch correlation, and a robust similarity-transform fit); it does not bundle or claim to be OpenCV or SAM2. The synthetic demo's initial mask is known from the drawing and is not an AI segmentation result.

No license for the repository owner's original application code is granted by this notice. The repository owner may choose an application license separately.
