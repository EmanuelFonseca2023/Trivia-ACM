import { T, PH, coffee, bug, sign, plaque, shell, rect, hatch } from './kit.js';

// Tres tambores, uno encima de otro. El rotor de abajo cambia salto y golpe.
// La lamparita del medio enciende la cámara tarde.

export function buildEnigma() {
  const w = 26;
  const h = 46;
  const floor = 42;
  const g = shell(w, h, floor);
  rect(g, 2, 39, 7, 1, 2);
  rect(g, 17, 39, 7, 1, 2);
  rect(g, 9, 36, 8, 1, 2);
  rect(g, 2, 33, 7, 1, 2);
  rect(g, 17, 33, 7, 1, 2);
  rect(g, 9, 30, 8, 1, 2);
  rect(g, 2, 24, 7, 1, 2);
  rect(g, 17, 24, 7, 1, 2);
  rect(g, 9, 21, 8, 1, 2);
  rect(g, 8, 18, 10, 1, 2);

  const wheel = (label, y) => ({ kind: 'rotor', x: 13 * T, y, r: 36, label });

  return {
    id: 'enigma',
    name: 'La Máquina',
    par: 120,
    wallJump: true,
    quiz: 'enigma',
    quizTitle: 'ENIGMA',
    glyphSet: ['A', 'B', 'C', 'I', 'II', 'III', 'UKW', 'Q'],
    sky: { top: '#3d4028', mid: '#1c2214', bot: '#10140c' },
    hues: ['#2c321c', '#3a3420', '#243028'],
    brick: { a: '#6a7048', b: '#8a8a58', c: '#3e4428' },
    w, h, grid: g, floorRow: null,
    groundY: floor * T,
    spawn: { x: 4 * T, y: floor * T - PH },
    doors: [hatch(1, 27, w - 2, 'enigma')],
    markers: [
      wheel('III', 40 * T),
      wheel('II', 34 * T),
      wheel('I', 23 * T),
      { kind: 'label', x: 13 * T, y: 27 * T + 40, t: 'UKW' },
      plaque(2, 39, 'Scherbius, 1918', ['Ingeniero. Patentó.', 'Enigma: acertijo.']),
      plaque(18, 39, 'Scherbius, 1918', ['Ingeniero. Patentó.', 'Enigma: acertijo.']),
      plaque(2, 33, 'Tres ruedas', ['Giran con cada letra.', 'Nunca sale igual.']),
      plaque(17, 33, 'Tres ruedas', ['Giran con cada letra.', 'Nunca sale igual.']),
      plaque(9, 30, 'La lámpara', ['Pulsas una tecla.', 'Se enciende otra letra.']),
    ],
    coffees: [coffee(8, floor), coffee(4, 39), coffee(19, 39), coffee(12, 36), coffee(4, 33), coffee(12, 21), coffee(10, 18)],
    enemies: [
      bug(16, floor, -1, 'scramble'),
      bug(10, 30, 1, 'lag-cam'),
    ],
    signs: [
      sign(4, floor, ['Ese rotor cambió las teclas.', 'Abajo salta. Arriba golpea.']),
      sign(16, 30, ['Los carteles ya lo dijeron.', 'E abre el reflector.']),
    ],
    exit: { x: 15 * T, y: 16 * T, w: 2 * T, h: 2 * T },
    boss: null,
    terminal: null,
  };
}
