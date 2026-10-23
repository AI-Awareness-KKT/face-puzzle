// Classic scripts work both from a file and from GitHub Pages.
// Each module adds its public helpers to one shared namespace.
(() => {
  'use strict';
  // Hysteresis and a 65 ms debounce prevent accidental repeated swaps.
  class Pinch {
    constructor() {
      this.reset();
    }
    reset() {
      this.closed = false;
      this.armed = false;
      this.candidate = null;
      this.since = 0;
    }
    update(ratio, now) {
      // Require an open hand before grabbing, and debounce both edges.
      const target = this.closed ? ratio < .48 : ratio < .30;
      if (!target) this.armed = true;
      if (!this.armed || target === this.closed) {
        this.candidate = null;
        return null;
      }
      if (target !== this.candidate) {
        this.candidate = target;
        this.since = now;
      }
      if (now - this.since < 65) return null;
      this.closed = target;
      this.candidate = null;
      return target ? 'grab' : 'release';
    }
  }

  Object.assign(window.FacePuzzle ||= {}, {
    Pinch
  });
})();
