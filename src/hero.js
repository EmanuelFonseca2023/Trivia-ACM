// Píxel: una terminal con patas. El hitbox del juego sigue siendo 22×36;
// este dibujo puede salir un poco de esa caja.

function round(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

function meat(ctx, x, y, w, h, r, fill) {
  round(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#14221c';
  ctx.stroke();
}

export function drawHero(ctx, p, ghost, tick) {
  if (!p) return;
  if (!ghost && p.invuln > 0 && ((tick / 4) | 0) % 2 === 0) return;
  const feetX = p.x + p.w / 2;
  const feetY = p.y + p.h;
  ctx.save();
  ctx.translate(feetX, feetY);
  const vx = p.vx || 0;
  const facing = p.facing || 1;
  const lean = Math.max(-9, Math.min(9, vx * facing)) * 0.02;
  ctx.rotate(lean);
  if (p.hitFlash > 0) ctx.filter = 'brightness(3)';
  if (!ghost) {
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath();
    ctx.ellipse(0, 3, p.grounded ? 14 : 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const squash = p.squash || 1;
  const widen = (2 - squash) * (1 + Math.min(0.22, (p.mach || 0) * 0.18));
  ctx.scale(facing * widen, squash);
  ctx.globalAlpha = ghost ? 0.25 : 1;

  const step = Math.sin(p.cycle || 0);
  const turbo = (p.mach || 0) > 0.75;
  meat(ctx, -12, -16 + step * 2, 8, 13, 3, '#145c45');
  meat(ctx, 4, -16 - step * 2, 8, 13, 3, '#145c45');
  meat(ctx, -13, -19, 9, 6, 2, '#ffe14a');
  meat(ctx, 4, -19, 9, 6, 2, '#ffe14a');

  meat(ctx, -18 + step * 2, -30, 9, 9, 3, '#b6ff6a');
  meat(ctx, 9 - step * 2, -30, 9, 9, 3, '#b6ff6a');
  meat(ctx, -16, -50, 32, 30, 8, '#7dffb3');

  ctx.fillStyle = '#10281f';
  round(ctx, -12, -46, 24, 18, 4);
  ctx.fill();

  const eye = turbo ? 5 : 4;
  ctx.fillStyle = '#f4fff8';
  ctx.fillRect(-9, -43, eye + 2, eye + 2);
  ctx.fillRect(3, -43, eye + 2, eye + 2);
  ctx.fillStyle = '#062018';
  ctx.fillRect(-7, -41, 2.4, 2.4);
  ctx.fillRect(6, -41, 2.4, 2.4);

  const blink = ((tick / 10) | 0) % 8 < 5;
  ctx.fillStyle = blink ? '#ffe14a' : '#1d6b45';
  ctx.fillRect(-3, -34, blink ? 8 : 3, 3);

  ctx.strokeStyle = '#ffe14a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -50);
  ctx.lineTo(0, -58);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -61, turbo ? 5 : 4, 0, Math.PI * 2);
  ctx.fillStyle = '#ffe14a';
  ctx.fill();
  ctx.strokeStyle = '#14221c';
  ctx.stroke();

  ctx.restore();
}
