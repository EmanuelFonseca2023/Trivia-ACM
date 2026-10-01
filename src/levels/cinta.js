import { T, PH, coffee, bug, ghost, sign, plaque, shell, rect, hatch } from './kit.js';

// La cinta se dobla: franjas largas que suben de un lado al otro.
// La cabeza lee tarde: lo que pulsas pasa un instante después.

export function buildCinta() {
  const w = 36;
  const h = 36;
  const floor = 32;
  const g = shell(w, h, floor);
  rect(g, 16, 29, 16, 1, 2);
  rect(g, 4, 26, 14, 1, 2);
  rect(g, 20, 23, 12, 1, 2);
  rect(g, 4, 17, 14, 1, 2);
  rect(g, 18, 14, 12, 1, 2);
  rect(g, 6, 11, 8, 1, 2);

  const bit = (t, tx, ty) => ({ kind: 'bit', t, x: tx * T, y: ty * T - 10 });

  return {
    id: 'cinta',
    name: 'La Cinta',
    par: 120,
    wallJump: true,
    quiz: 'turing',
    quizTitle: 'BOMBE',
    glyphSet: ['0', '1', 'q0', 'B', '0', '1', '⊢', '1'],
    sky: { top: '#1e3a5f', mid: '#142433', bot: '#0c1218' },
    hues: ['#1a3050', '#243044', '#16324a'],
    brick: { a: '#2a4a72', b: '#3d6494', c: '#16304e' },
    w, h, grid: g, floorRow: null,
    groundY: floor * T,
    spawn: { x: 3 * T, y: floor * T - PH },
    doors: [hatch(1, 20, w - 2, 'turing')],
    markers: [
      bit('0', 18, 29), bit('1', 24, 29), bit('0', 30, 29),
      bit('1', 6, 26), bit('0', 12, 26),
      bit('1', 22, 23), bit('0', 28, 23),
      bit('⊢', 8, 17), bit('1', 14, 17),
      { kind: 'label', x: 18 * T, y: 20 * T + 42, t: 'BOMBE' },
      plaque(22, 29, 'Turing, 1936', ['Una cinta infinita', 'y una cabeza que la lee.']),
      plaque(8, 26, 'Rejewski', ['En Polonia, antes de la guerra,', 'reconstruyó la Enigma.']),
      plaque(24, 23, 'Joan Clarke', ['Con Turing, en Bletchley,', 'leía los mensajes de los barcos.']),
    ],
    coffees: [coffee(6, floor), coffee(20, 29), coffee(8, 26), coffee(24, 23), coffee(8, 17), coffee(22, 14), coffee(13, 11)],
    enemies: [
      bug(10, floor, 1, 'echo'),
      ghost(22, 28, 16, 30, 0, 'head'),
    ],
    signs: [
      sign(4, floor, ['La cabeza lee tarde.', 'Aplástala y las teclas vuelven.']),
      sign(22, 23, ['Lee los carteles.', 'E abre la Bombe.']),
    ],
    exit: { x: 8 * T, y: 8 * T, w: 3 * T, h: 3 * T },
    boss: null,
    terminal: null,
  };
}
