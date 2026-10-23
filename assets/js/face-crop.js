// Classic scripts work both from a file and from GitHub Pages.
// Each module adds its public helpers to one shared namespace.
(() => {
  'use strict';
  // Expand the detected face into a square crop bounded by the video frame.
  function faceCrop(box, width, height) {
    const size = Math.min(Math.max(box.width, box.height) * 1.65, width, height);
    return {
      x: Math.max(0, Math.min(width - size, box.originX + box.width / 2 - size / 2)),
      y: Math.max(0, Math.min(height - size, box.originY + box.height / 2 - size / 2)),
      size
    };
  }

  Object.assign(window.FacePuzzle ||= {}, {
    faceCrop
  });
})();
