// Piezas sueltas. Un tile mide 32px.
// El salto llega a unos 120px: un hueco de 3 tiles (96px) se salta; uno de 4, no.
// El punto y coma deja el salto en ~39px: un escalón de 1 tile sí, uno de 2 no.
// Cada nivel se dibuja a mano. No hay una torre plantilla.

export const T = 32;
export const PH = 36;

export function grid(w, h) {
  return Array.from({ length: h }, () => Array(w).fill(0));
}

export function rect(g, x, y, w, h, v) {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) {
      if (j >= 0 && i >= 0 && j < g.length && i < g[0].length) g[j][i] = v;
    }
  }
}

export function coffee(tx, floorTy) {
  return { x: tx * T + 8, y: floorTy * T - 16, w: 16, h: 16, got: false };
}

export function bug(tx, floorTy, dir, glitch) {
  return {
    kind: 'bug',
    x: tx * T + 2,
    y: floorTy * T - 24,
    w: 28,
    h: 24,
    dir: dir || 1,
    speed: 0.75,
    dead: false,
    timer: 0,
    glitch: glitch || null,
  };
}

export function ghost(tx, ty, minTx, maxTx, phase, skin) {
  return {
    kind: 'ghost',
    x: tx * T,
    y: ty * T,
    baseY: ty * T,
    minX: minTx * T,
    maxX: maxTx * T,
    dir: 1,
    speed: 1.15,
    phase: phase || 0,
    w: 32,
    h: 32,
    dead: false,
    timer: 0,
    skin: skin || 'null',
  };
}

export function shell(w, h, floor) {
  const g = grid(w, h);
  rect(g, 0, 0, w, 2, 1);
  rect(g, 0, 0, 1, h, 1);
  rect(g, w - 1, 0, 1, h, 1);
  rect(g, 0, floor, w, h - floor, 1);
  return g;
}

export function plaque(tx, ty, title, lines) {
  return { kind: 'plaque', x: tx * T, y: ty * T, title, lines };
}

export function hatch(tx, ty, tw, topic) {
  return { kind: 'hatch', tx, ty, tw, th: 1, open: false, failed: false, topic: topic || null };
}

export function sign(tx, floorTy, lines) {
  return { x: tx * T, y: floorTy * T - 8, lines };
}
