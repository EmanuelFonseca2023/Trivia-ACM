import { T, PH, grid, rect, bug, ghost, sign, plaque } from './kit.js';

export function buildBoss() {
  const w = 30;
  const h = 22;
  const floor = 18;
  const groundY = floor * T;
  const g = grid(w, h);
  rect(g, 0, 0, w, 2, 1);
  rect(g, 0, 0, 1, h, 1);
  rect(g, w - 1, 0, 1, h, 1);
  rect(g, 0, floor, w, h - floor, 1);
  rect(g, 14, 15, 2, 3, 1);
  rect(g, 23, 14, 2, 4, 1);
  rect(g, 16, 12, 6, 1, 2);

  return {
    id: 'boss',
    name: 'Segfault',
    par: 75,
    wallJump: true,
    brick: { a: '#8a2048', b: '#b42e58', c: '#4a1028' },
    w, h, grid: g, floorRow: null,
    groundY,
    spawn: { x: 6 * T, y: groundY - PH },
    doors: [],
    coffees: [],
    enemies: [
      bug(26, floor, -1, 'flip'),
      ghost(18, 10, 16, 22, 1, 'null'),
    ],
    signs: [
      sign(4, floor, ['Null invierte ← y →.', 'Aplástalo. La pregunta está en el cartel.']),
    ],
    markers: [
      plaque(8, 18, 'Segfault', ['Ausencia de valor', 'No es 0. Se cae.']),
    ],
    exit: null,
    boss: {
      x: 20 * T,
      y: groundY - 58,
      w: 86,
      h: 58,
      dir: -1,
      hp: 3,
      maxHp: 3,
      stun: 0,
      enrage: 0,
      timer: 0,
      hurt: 0,
      dying: 0,
      minX: 2 * T,
      maxX: 28 * T - 8,
    },
    terminal: { x: 2 * T, y: groundY - 36, w: 40, h: 36 },
  };
}
