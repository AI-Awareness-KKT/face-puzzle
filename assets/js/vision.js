// Classic scripts work both from a file and from GitHub Pages.
// Each module adds its public helpers to one shared namespace.
(() => {
  'use strict';
  // This function becomes the complete worker program when converted to text.
  function visionWorkerMain() {
    let face, hand;
    self.onmessage = async ({
      data
    }) => {
      if (data.type === 'init') {
        try {
          const {
            FilesetResolver,
            FaceDetector,
            HandLandmarker
          } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs');
          const files = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
          face = await FaceDetector.createFromOptions(files, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
              delegate: 'CPU'
            },
            runningMode: 'VIDEO',
            minDetectionConfidence: .65
          });
          hand = await HandLandmarker.createFromOptions(files, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
              delegate: 'CPU'
            },
            runningMode: 'VIDEO',
            numHands: 1,
            minHandDetectionConfidence: .6,
            minTrackingConfidence: .6
          });
          self.postMessage({
            type: 'ready'
          });
        } catch (error) {
          self.postMessage({
            type: 'error',
            message: error.message
          });
        }
      }
      if (data.type === 'frame') {
        try {
          const result = data.mode === 'face' ? face.detectForVideo(data.bitmap, data.time) : hand.detectForVideo(data.bitmap, data.time);
          self.postMessage({
            type: 'result',
            mode: data.mode,
            time: data.time,
            box: result.detections?.[0]?.boundingBox ?? null,
            landmarks: result.landmarks?.[0] ?? null
          });
        } catch (error) {
          self.postMessage({
            type: 'error',
            message: error.message
          });
        } finally {
          data.bitmap.close();
        }
      }
    };

  }

  // Build a Blob worker instead of fetching a local worker file.
  // This preserves the original double-click HTML workflow in desktop Chrome.
  function createVisionWorker() {
    const source = `(${visionWorkerMain.toString()})();`;
    const url = URL.createObjectURL(new Blob([source], {
      type: 'text/javascript'
    }));
    try {
      return new Worker(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  Object.assign(window.FacePuzzle ||= {}, {
    createVisionWorker
  });
})();
