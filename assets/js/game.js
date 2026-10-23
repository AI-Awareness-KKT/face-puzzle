// Classic scripts work both from a file and from GitHub Pages.
// Each module adds its public helpers to one shared namespace.
(() => {
  'use strict';
  const {
    solved,
    shuffle,
    swap,
    cellAt,
    Pinch,
    faceCrop,
    createVisionWorker
  } = window.FacePuzzle;
  // Cache the page elements once, then keep all game state in this closure.
  const $ = id => document.getElementById(id);
  const video = $('video'),
    board = $('board'),
    cursor = $('cursor');
  const overlay = $('overlay'),
    ctx = overlay.getContext('2d');
  let tiles = [],
    image = '',
    isDemo = false,
    moves = 0,
    began = 0,
    ended = 0;
  let selected = -1,
    hovered = -1,
    pointer = null,
    stream = null,
    worker = null;
  let ready = false,
    busy = false,
    mode = 'face',
    lastFrame = -1,
    lastDetect = 0;
  let stableSince = 0,
    previousBox = null,
    lastHand = 0,
    smooth = null,
    gestureEnabled = true;
  let cameraGeneration = 0;
  const pinch = new Pinch();
  // Update the accessible status message below the board.
  function message(text) {
    $('message').textContent = text;
  }
  // Cancel a held tile when tracking is lost or another interaction starts.
  function cancelGrab() {
    selected = -1;
    hovered = -1;
    pinch.reset();
    smooth = null;
    cursor.style.display = 'none';
    highlight();
  }
  // Apply visual feedback without rebuilding the board.
  function highlight() {
    [...board.children].forEach((el, i) => {
      el.classList.toggle('selected', i === selected);
      el.classList.toggle('target', i === hovered && selected >= 0 && i !== selected);
    });
  }
  // Render nine buttons, each showing one portion of the original photo.
  function render() {
    board.replaceChildren();
    const showOriginal = $('peek').getAttribute('aria-pressed') === 'true';
    tiles.forEach((tile, i) => {
      const n = showOriginal ? i : tile;
      const button = document.createElement('button');
      button.className = 'tile' + (isDemo ? ' demo' : '');
      button.setAttribute('aria-label', `Position ${i+1}, piece ${n+1}`);
      button.disabled = showOriginal;
      if (isDemo) button.textContent = n + 1;
      else {
        button.style.backgroundImage = `url("${image}")`;
        button.style.backgroundPosition = `${n%3*50}% ${Math.floor(n/3)*50}%`;
        const label = document.createElement('span');
        label.className = 'number';
        label.textContent = n + 1;
        button.append(label);
      }
      button.addEventListener('pointerdown', event => {
        if (showOriginal || solved(tiles)) return;
        gestureEnabled = false;
        cancelGrab();
        pointer = {
          from: i,
          x: event.clientX,
          y: event.clientY
        };
        selected = i;
        highlight();
        button.setPointerCapture(event.pointerId);
      });
      button.addEventListener('pointermove', event => {
        if (pointer) {
          hovered = pointCell(event.clientX, event.clientY);
          highlight();
        }
      });
      button.addEventListener('pointerup', event => {
        if (!pointer) return;
        const from = pointer.from,
          target = pointCell(event.clientX, event.clientY),
          dragged = Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 10;
        pointer = null;
        selected = -1;
        if (dragged && target >= 0 && target !== from) performSwap(from, target);
        else if (!dragged) clickSelect(from);
        else highlight();
        pinch.reset();
        gestureEnabled = true;
      });
      button.addEventListener('pointercancel', () => {
        pointer = null;
        cancelGrab();
        gestureEnabled = true;
      });
      // Native keyboard clicks have detail 0; pointer actions handled above.
      button.addEventListener('click', event => {
        if (event.detail === 0 && !solved(tiles)) clickSelect(i);
      });
      board.append(button);
    });
    highlight();
  }
  let clickFrom = -1;
  // Two clicks (or keyboard activations) select the two pieces to swap.
  function clickSelect(i) {
    if (clickFrom >= 0 && clickFrom !== i) {
      const from = clickFrom;
      clickFrom = -1;
      selected = -1;
      performSwap(from, i);
    } else {
      clickFrom = clickFrom === i ? -1 : i;
      selected = clickFrom;
      highlight();
    }
  }
  // Convert mouse/touch screen coordinates to a board position.
  function pointCell(x, y) {
    const r = board.getBoundingClientRect();
    return cellAt((x - r.left) / r.width, (y - r.top) / r.height);
  }
  // One shared path for mouse, touch, keyboard, and hand-gesture swaps.
  function performSwap(a, b) {
    if (a < 0 || b < 0 || a === b || ended || $('peek').getAttribute('aria-pressed') === 'true') return;
    tiles = swap(tiles, a, b);
    moves++;
    $('moves').textContent = String(moves).padStart(2, '0');
    clickFrom = -1;
    selected = -1;
    hovered = -1;
    const correct = tiles.filter((t, i) => t === i).length;
    $('progress').textContent = `${correct} / 9 matched`;
    if (solved(tiles)) {
      ended = performance.now();
      message(`You did it! ${moves} swaps.`);
      cancelGrab();
    } else message('Pinch, move, release to swap.');
    render();
  }
  // Reset the score, create a new permutation, and enable hand mode.
  function startPuzzle(demo = false) {
    isDemo = demo;
    tiles = shuffle();
    moves = 0;
    began = performance.now();
    ended = 0;
    clickFrom = -1;
    cancelGrab();
    $('moves').textContent = '00';
    $('timer').textContent = '00:00';
    $('welcome').hidden = true;
    $('start').hidden = false;
    $('demo').hidden = false;
    $('retake').textContent = stream ? 'Retake photo' : 'Open camera';
    $('peek').setAttribute('aria-pressed', 'false');
    $('peek').textContent = 'Show original';
    $('shuffle').disabled = false;
    $('peek').disabled = false;
    // Keep a path to the camera after playing the camera-free demo.
    $('retake').disabled = false;
    $('progress').textContent = `${tiles.filter((t,i)=>t===i).length} / 9 matched`;
    mode = 'hand';
    render();
    message(demo ? 'Arrange the numbers from 1 to 9.' : 'Pinch, move, release to swap.');
  }
  // Draw a square mirrored snapshot; only the data URL stays in memory.
  function capture(box = null) {
    if (!stream || video.readyState < 2) return;
    const w = video.videoWidth,
      h = video.videoHeight;
    const crop = box ? faceCrop(box, w, h) : {
      x: (w - Math.min(w, h)) / 2,
      y: (h - Math.min(w, h)) / 2,
      size: Math.min(w, h)
    };
    const photo = document.createElement('canvas');
    photo.width = photo.height = 720;
    const p = photo.getContext('2d');
    p.translate(720, 0);
    p.scale(-1, 1);
    p.drawImage(video, crop.x, crop.y, crop.size, crop.size, 0, 0, 720, 720);
    image = photo.toDataURL('image/jpeg', .92);
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    startPuzzle();
    $('manual').hidden = true;
    $('tracking').textContent = ready ? 'Raise one hand. Open your fingers before pinching.' : 'Hand tracking unavailable. Use mouse, touch, or keyboard.';
  }
  // Start a background worker; degrade to manual controls if models fail.
  async function loadVision() {
    if (worker && ready) return;
    if (worker) {
      worker.terminate();
      worker = null;
      busy = false;
    }
    try {
      worker = createVisionWorker();
      worker.onmessage = ({
        data
      }) => {
        if (data.type === 'ready') {
          ready = true;
          if (stream) $('tracking').textContent = mode === 'face' ? 'Look at the camera and hold still.' : 'Raise one hand to play.';
        }
        if (data.type === 'error') {
          busy = false;
          ready = false;
          $('manual').hidden = !stream || mode !== 'face';
          $('tracking').textContent = 'Tracking could not load. Check your connection, capture manually, and use mouse or touch.';
          cancelGrab();
        }
        if (data.type === 'result') {
          busy = false;
          if (stream && data.mode === mode) {
            if (mode === 'face') processFace(data.box, data.time);
            else processHand(data.landmarks, data.time);
          }
        }
      };
      worker.onerror = () => {
        ready = false;
        busy = false;
        $('manual').hidden = !stream || mode !== 'face';
        $('tracking').textContent = 'Tracking unavailable. Capture manually and use mouse or touch.';
      };
      worker.postMessage({
        type: 'init'
      });
    } catch {
      $('tracking').textContent = 'Tracking unavailable. Use manual capture and mouse or touch.';
    }
  }
  // Ask for video permission only after the player clicks Open camera.
  async function openCamera() {
    $('start').disabled = true;
    const generation = ++cameraGeneration;
    try {
      if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('This browser does not allow camera access here. Open this HTML file in desktop Google Chrome.');
      const opened = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: {
            ideal: 640
          },
          height: {
            ideal: 480
          }
        },
        audio: false
      });
      if (generation !== cameraGeneration) {
        opened.getTracks().forEach(t => t.stop());
        return;
      }
      stream = opened;
      video.srcObject = stream;
      await video.play();
      overlay.width = video.videoWidth;
      overlay.height = video.videoHeight;
      $('camera-placeholder').hidden = true;
      $('camera-state').textContent = 'Live';
      $('stop').disabled = false;
      $('retake').disabled = false;
      $('manual').hidden = false;
      stableSince = 0;
      previousBox = null;
      lastFrame = -1;
      mode = mode === 'face' ? 'face' : 'hand';
      $('manual').hidden = mode !== 'face';
      $('tracking').textContent = 'Loading face and hand tracking…';
      stream.getVideoTracks()[0].addEventListener('ended', () => stopCamera());
      await loadVision();
      if (ready) $('tracking').textContent = 'Look at the camera and hold still.';
      message(mode === 'face' ? 'Camera is open. Hold your face still.' : 'Camera resumed. Raise one hand.');
      $('start').textContent = 'Camera open';
    } catch (error) {
      stopCamera();
      $('tracking').textContent = error.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in browser settings and try again.' : error.message;
      message('Camera unavailable. You can try the demo.');
    } finally {
      $('start').disabled = false;
    }
  }
  // Release the webcam but retain the current puzzle.
  function stopCamera() {
    ++cameraGeneration;
    const old = stream;
    stream = null;
    old?.getTracks().forEach(t => t.stop());
    video.srcObject = null;
    $('camera-placeholder').hidden = false;
    $('camera-state').textContent = 'Off';
    $('stop').disabled = true;
    $('retake').disabled = !tiles.length;
    $('manual').hidden = true;
    $('start').hidden = false;
    $('demo').hidden = false;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    cancelGrab();
    $('tracking').textContent = 'Camera stopped. Your puzzle is still playable.';
    $('start').textContent = 'Open camera';
    $('retake').textContent = tiles.length ? 'Open camera' : 'Retake photo';
  }
  // Capture after 1.8 seconds without large motion between detections.
  function processFace(box, now) {
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    if (!box) {
      stableSince = 0;
      previousBox = null;
      $('tracking').textContent = 'Bring your face into view.';
      return;
    }
    const crop = faceCrop(box, video.videoWidth, video.videoHeight);
    ctx.strokeStyle = '#afffc8';
    ctx.lineWidth = 3;
    ctx.strokeRect(overlay.width - crop.x - crop.size, crop.y, crop.size, crop.size);
    const moved = !previousBox || Math.hypot(box.originX - previousBox.originX, box.originY - previousBox.originY) > box.width * .15 || Math.abs(box.width - previousBox.width) > box.width * .15;
    if (moved) stableSince = now;
    previousBox = box;
    const left = Math.max(1, Math.ceil((1800 - (now - stableSince)) / 1000));
    $('tracking').textContent = `Hold still. Capturing in ${left}…`;
    if (now - stableSince >= 1800) capture(box);
  }
  // Draw hand landmarks, map finger motion, and detect grab/release edges.
  function processHand(lm, now) {
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    if (!lm) {
      cancelGrab();
      lastHand = 0;
      $('tracking').textContent = 'Raise one hand, palm facing the camera.';
      return;
    }
    lastHand = now;
    ctx.strokeStyle = '#afffc8';
    ctx.lineWidth = 2;
    for (const chain of [
        [0, 1, 2, 3, 4],
        [0, 5, 6, 7, 8],
        [5, 9, 10, 11, 12],
        [9, 13, 14, 15, 16],
        [13, 17, 18, 19, 20],
        [0, 17]
      ]) {
      ctx.beginPath();
      chain.forEach((i, j) => {
        const x = (1 - lm[i].x) * overlay.width,
          y = lm[i].y * overlay.height;
        j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
    }
    if (!gestureEnabled || ended || !tiles.length || $('peek').getAttribute('aria-pressed') === 'true') {
      cancelGrab();
      return;
    }
    const raw = {
      x: Math.max(0, Math.min(.999, (1 - lm[8].x - .1) / .8)),
      y: Math.max(0, Math.min(.999, (lm[8].y - .1) / .8))
    };
    smooth = smooth ? {
      x: smooth.x * .55 + raw.x * .45,
      y: smooth.y * .55 + raw.y * .45
    } : raw;
    const r = board.getBoundingClientRect();
    cursor.style.display = 'block';
    cursor.style.left = `${smooth.x*r.width}px`;
    cursor.style.top = `${smooth.y*r.height}px`;
    const distance = (a, b) => Math.hypot((a.x - b.x) * video.videoWidth, (a.y - b.y) * video.videoHeight);
    const ratio = distance(lm[4], lm[8]) / Math.max(1, distance(lm[5], lm[17]));
    const edge = pinch.update(ratio, now),
      cell = cellAt(smooth.x, smooth.y);
    cursor.classList.toggle('pinching', pinch.closed);
    if (edge === 'grab') {
      clickFrom = -1;
      selected = cell;
    }
    hovered = cell;
    if (edge === 'release') {
      const from = selected;
      selected = -1;
      performSwap(from, cell);
    }
    highlight();
    $('tracking').textContent = pinch.closed ? 'Keep pinching. Move to a tile and release.' : 'Point at a tile, then pinch to grab.';
  }
  // At most one frame is in flight; transfer its bitmap to the worker.
  async function frame(now) {
    requestAnimationFrame(frame);
    if (stream && ready && !busy && video.readyState >= 2 && now - lastDetect > 65 && video.currentTime !== lastFrame && !document.hidden) {
      busy = true;
      lastFrame = video.currentTime;
      lastDetect = now;
      const generation = cameraGeneration;
      try {
        const bitmap = await createImageBitmap(video);
        if (!stream || generation !== cameraGeneration) {
          bitmap.close();
          busy = false;
          return;
        }
        worker.postMessage({
          type: 'frame',
          bitmap,
          time: now,
          mode
        }, [bitmap]);
      } catch {
        busy = false;
      }
    }
    if (lastHand && now - lastHand > 400) {
      cancelGrab();
      lastHand = 0;
    }
  }
  // Wire each page button to the corresponding controller function.
  $('start').onclick = openCamera;
  $('demo').onclick = () => startPuzzle(true);
  $('manual').onclick = () => capture();
  $('stop').onclick = stopCamera;
  $('shuffle').onclick = () => startPuzzle(isDemo);
  $('retake').onclick = async () => {
    if (!stream) {
      await openCamera();
      if (!stream) return;
    }
    mode = 'face';
    ended = 0;
    began = 0;
    stableSince = 0;
    previousBox = null;
    cancelGrab();
    $('retake').textContent = 'Retake photo';
    $('welcome').hidden = false;
    $('start').hidden = true;
    $('demo').hidden = true;
    $('welcome').querySelector('h2').textContent = 'Look at the camera.';
    $('welcome').querySelector('p').textContent = 'Hold still to capture a new puzzle.';
    $('manual').hidden = false;
  };
  $('peek').onclick = () => {
    const active = $('peek').getAttribute('aria-pressed') !== 'true';
    $('peek').setAttribute('aria-pressed', String(active));
    $('peek').textContent = active ? 'Back to puzzle' : 'Show original';
    cancelGrab();
    clickFrom = -1;
    render();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelGrab();
  });
  window.addEventListener('pagehide', stopCamera);
  // Refresh the visible timer independently of vision inference.
  setInterval(() => {
    if (!began) return;
    const sec = Math.floor(((ended || performance.now()) - began) / 1000);
    $('timer').textContent = `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
  }, 250);
  requestAnimationFrame(frame);


})();
