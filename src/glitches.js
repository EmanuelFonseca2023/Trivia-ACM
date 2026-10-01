// Cada bug rompe una cosa distinta. Aplastarlo la arregla.
// El id es la mecánica. El nombre es lo que se lee encima del bicho.

export const GLITCHES = {
  'short-jump': { name: 'Punto y coma', fixed: '¡La frase sigue!' },
  heavy: { name: 'Stack overflow', fixed: '¡La pila respira!' },
  scramble: { name: 'Rotor', fixed: '¡Salto y golpe volvieron!' },
  'lag-cam': { name: 'Lamparita', fixed: '¡La lámpara responde!' },
  echo: { name: 'Cabeza lenta', fixed: '¡La cabeza lee al día!' },
  'no-cling': { name: 'No trepa', fixed: '¡Ya trepas la pared!' },
  flip: { name: 'Null', fixed: '¡Null atrapado!' },
  'no-turbo': { name: 'Turbo roto', fixed: '¡Turbo arreglado!' },
  'no-pound': { name: 'Golpe roto', fixed: '¡Golpe arreglado!' },
  ice: { name: 'Piso de hielo', fixed: '¡Piso arreglado!' },
};

export function glitchOn(run, id) {
  return !!(run && run.glitches && run.glitches[id]);
}

export function activeGlitchNames(run) {
  if (!run || !run.glitches) return [];
  return Object.keys(run.glitches)
    .filter((id) => run.glitches[id] && GLITCHES[id])
    .map((id) => GLITCHES[id].name);
}
