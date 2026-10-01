import { buildHello } from './hello.js';
import { buildTower } from './tower.js';
import { buildEnigma } from './enigma.js';
import { buildCinta } from './cinta.js';
import { buildTemplo } from './templo.js';
import { buildBoss } from './boss.js';

// Para agregar un nivel:
// 1. Crea src/levels/mi-nivel.js y exporta buildMiNivel().
// 2. Impórtalo aquí.
// 3. Súmalo a `list` (el orden del menú) y a `builders`.

const builders = {
  hello: buildHello,
  tower: buildTower,
  enigma: buildEnigma,
  cinta: buildCinta,
  templo: buildTemplo,
  boss: buildBoss,
};

export const LevelBank = {
  list: [
    {
      id: 'hello',
      name: 'Hello, World',
      chapter: 'Nivel 1',
      blurb: 'El punto y coma corta el salto.',
    },
    {
      id: 'tower',
      name: 'La Torre',
      chapter: 'Nivel 2',
      blurb: 'La pila pesa. Dos pisos con portero.',
    },
    {
      id: 'enigma',
      name: 'La Máquina',
      chapter: 'Nivel 3',
      blurb: 'Tres tambores. El rotor cambia las teclas.',
    },
    {
      id: 'cinta',
      name: 'La Cinta',
      chapter: 'Nivel 4',
      blurb: 'La cinta se dobla. La cabeza lee tarde.',
    },
    {
      id: 'templo',
      name: 'El Templo',
      chapter: 'Nivel 5',
      blurb: 'Pirámide y un pozo que solo se trepa.',
    },
    {
      id: 'boss',
      name: 'Segfault',
      chapter: 'Jefe',
      blurb: 'Null invierte izquierda y derecha.',
    },
  ],
  build(id) {
    const make = builders[id] || buildHello;
    return make();
  },
};
