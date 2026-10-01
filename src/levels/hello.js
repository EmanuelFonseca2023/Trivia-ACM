import { T, PH, coffee, bug, ghost, sign, plaque, shell, rect, hatch } from './kit.js';

// Escalera de frases. Los escalones de 1 tile se suben aunque el salto esté corto.
// El hueco de 3 tiles, no: ahí se nota el punto y coma.

export function buildHello() {
  const w = 30;
  const h = 30;
  const floor = 26;
  const g = shell(w, h, floor);
  rect(g, 8, 25, 4, 1, 2);
  rect(g, 12, 24, 4, 1, 2);
  rect(g, 16, 23, 4, 1, 2);
  rect(g, 18, 20, 8, 1, 2);
  rect(g, 6, 17, 10, 1, 2);
  rect(g, 16, 11, 8, 1, 2);
  rect(g, 6, 8, 7, 1, 2);
  rect(g, 26, 21, 2, 1, 1);
  rect(g, 27, 17, 1, 4, 1);
  rect(g, 26, 16, 2, 1, 1);

  return {
    id: 'hello',
    name: 'Hello, World',
    par: 80,
    wallJump: true,
    w, h, grid: g, floorRow: null,
    groundY: floor * T,
    spawn: { x: 3 * T, y: floor * T - PH },
    doors: [hatch(1, 14, w - 2, 'hello')],
    coffees: [coffee(6, floor), coffee(20, 20), coffee(8, 17), coffee(12, 8)],
    enemies: [
      bug(20, floor, -1, 'short-jump'),
      ghost(18, 12, 16, 24, 1, 'note'),
    ],
    signs: [
      sign(4, floor, ['print("hola") muestra hola.', 'El bicho es un punto y coma: el salto no llega.']),
      sign(8, 17, ['Lee el cartel.', 'E abre el techo.']),
    ],
    markers: [
      plaque(10, 17, 'Punto y coma', ['Cierra la instrucción.', 'Si se corta, el salto no llega.']),
    ],
    exit: { x: 8 * T, y: 5 * T, w: 3 * T, h: 3 * T },
    boss: null,
    terminal: null,
  };
}
