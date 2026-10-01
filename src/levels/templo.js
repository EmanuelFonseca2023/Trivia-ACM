import { T, PH, coffee, bug, ghost, sign, plaque, shell, rect, hatch } from './kit.js';

// Pirámide, luego un pozo estrecho. El salto no llega al borde:
// sin trepar la pared no se sale, y abajo se puede caer por la losa.

export function buildTemplo() {
  const w = 26;
  const h = 48;
  const floor = 44;
  const g = shell(w, h, floor);
  rect(g, 10, 41, 14, 3, 1);
  rect(g, 12, 38, 10, 3, 1);
  rect(g, 14, 35, 6, 3, 1);
  rect(g, 13, 33, 8, 1, 2);
  rect(g, 3, 27, 18, 1, 2);
  rect(g, 14, 24, 8, 1, 2);
  rect(g, 12, 23, 3, 1, 2);
  for (let y = 19; y <= 22; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (x < 12 || x > 14) g[y][x] = 1;
    }
  }
  rect(g, 4, 15, 8, 1, 2);
  rect(g, 15, 12, 7, 1, 2);
  rect(g, 6, 9, 7, 1, 2);

  return {
    id: 'templo',
    name: 'El Templo',
    par: 140,
    wallJump: true,
    quiz: 'temple',
    quizTitle: 'HOLYC',
    glyphSet: ['HolyC', '640', '16', '::', 'U8', 'God'],
    sky: { top: '#4a2a12', mid: '#241208', bot: '#120804' },
    hues: ['#3a2010', '#4a3018', '#2a140c'],
    brick: { a: '#c4843c', b: '#e0a85a', c: '#7a4e22' },
    w, h, grid: g, floorRow: null,
    groundY: floor * T,
    spawn: { x: 6 * T, y: floor * T - PH },
    doors: [hatch(1, 30, w - 2, 'temple'), hatch(1, 18, w - 2, 'screen')],
    markers: [
      plaque(1, 44, 'Terry A. Davis', ['Lo hizo él solo.']),
      plaque(13, 33, 'HolyC', ['El lenguaje del templo.', 'Es un pariente de C.']),
      plaque(4, 27, '640 × 480', ['La pantalla es pequeña.', 'Solo 16 colores.']),
      plaque(14, 27, 'Sin red', ['No se conecta a internet.', 'El oráculo: Donkey Kong.']),
      { kind: 'label', x: 13 * T, y: 7 * T, t: '640×480' },
    ],
    coffees: [coffee(8, floor), coffee(10, 41), coffee(12, 38), coffee(16, 35), coffee(8, 27), coffee(16, 24), coffee(12, 9)],
    enemies: [
      bug(9, floor, 1, 'no-cling'),
      ghost(6, 14, 4, 11, 1, 'oracle'),
    ],
    signs: [
      sign(8, floor, ['Ese bug no te deja trepar.', 'El pozo de arriba es solo pared.']),
      sign(20, 33, ['Lee los carteles.', 'E abre este techo.']),
      sign(18, 24, ['Entra al pozo y trepa.', 'Abajo, en la losa, caes.']),
    ],
    exit: { x: 8 * T, y: 6 * T, w: 3 * T, h: 3 * T },
    boss: null,
    terminal: null,
  };
}
