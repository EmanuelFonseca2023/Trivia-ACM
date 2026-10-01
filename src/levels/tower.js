import { T, PH, coffee, bug, ghost, sign, plaque, shell, rect, hatch } from './kit.js';

// Corte de un edificio. Los pisos son losas enteras con el hueco del ascensor a un lado.
// El bug de la pila te deja pesado: no llegas al primer piso hasta aplastarlo.

export function buildTower() {
  const w = 28;
  const h = 40;
  const floor = 36;
  const g = shell(w, h, floor);
  rect(g, 3, 33, 10, 1, 2);
  rect(g, 16, 30, 8, 1, 2);
  rect(g, 3, 24, 12, 1, 2);
  rect(g, 15, 21, 9, 1, 2);
  rect(g, 3, 18, 10, 1, 2);
  rect(g, 14, 12, 10, 1, 2);
  rect(g, 4, 9, 8, 1, 2);
  rect(g, 4, 34, 2, 2, 1);
  rect(g, 22, 28, 2, 2, 1);
  rect(g, 6, 22, 2, 2, 1);

  return {
    id: 'tower',
    name: 'La Torre',
    par: 130,
    wallJump: true,
    brick: { a: '#c44832', b: '#e25b3e', c: '#7a2a1c' },
    w, h, grid: g, floorRow: null,
    groundY: floor * T,
    spawn: { x: 3 * T, y: floor * T - PH },
    doors: [hatch(1, 27, w - 2, 'stack'), hatch(1, 15, w - 2, 'frames')],
    coffees: [coffee(8, floor), coffee(11, 33), coffee(18, 30), coffee(8, 24), coffee(17, 21), coffee(11, 9)],
    enemies: [
      bug(18, floor, -1, 'heavy'),
      ghost(20, 22, 16, 24, 0, 'null'),
      ghost(8, 11, 5, 14, 2, 'null'),
    ],
    signs: [
      sign(4, floor, ['Ese bug llena la pila.', 'Pesas: el salto no llega arriba.']),
      sign(17, 30, ['Lee el cartel.', 'E abre este piso.']),
      sign(12, 18, ['Otro portero.', 'Otra E, otra pregunta.']),
    ],
    markers: [
      plaque(3, 33, 'La pila', ['Cada llamada espera encima.', 'Si no caben, todo pesa.']),
      plaque(3, 18, 'Dos porteros', ['Termina primero quien fue llamado.', 'Después sigue el de abajo.']),
    ],
    exit: { x: 6 * T, y: 6 * T, w: 3 * T, h: 3 * T },
    boss: null,
    terminal: null,
  };
}
