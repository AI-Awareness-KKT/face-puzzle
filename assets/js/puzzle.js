// Classic scripts work both from a file and from GitHub Pages.
// Each module adds its public helpers to one shared namespace.
(() => {
  'use strict';
  // A piece value is its original position, numbered 0 through 8.
  const solved = tiles => tiles.every((tile, i) => tile === i);
  // Fisher-Yates shuffle; an already-solved shuffle is changed to a real puzzle.
  function shuffle(random = Math.random) {
    const tiles = Array.from({
      length: 9
    }, (_, i) => i);
    for (let i = 8; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    if (solved(tiles))[tiles[0], tiles[1]] = [tiles[1], tiles[0]];
    return tiles;
  }
  // Return a new array so the old board state remains unchanged.
  function swap(tiles, a, b) {
    if (![a, b].every(i => Number.isInteger(i) && i >= 0 && i < 9)) return tiles;
    const next = [...tiles];
    [next[a], next[b]] = [next[b], next[a]];
    return next;
  }
  // Convert normalized board coordinates to a row-major position.
  function cellAt(x, y) {
    if (x < 0 || y < 0 || x >= 1 || y >= 1) return -1;
    return Math.floor(y * 3) * 3 + Math.floor(x * 3);
  }

  Object.assign(window.FacePuzzle ||= {}, {
    solved,
    shuffle,
    swap,
    cellAt
  });
})();
