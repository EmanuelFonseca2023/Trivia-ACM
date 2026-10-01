// Estas dos no salen en ninguna puerta: el autotest fija su respuesta.
// Las que sí se preguntan están en stories.js, una por tramo del nivel.

export const BASIC = [
  {
    id: 'prec',
    q: '¿Cuánto es 2 + 3 × 2?',
    options: ['10', '8', '7', '6'],
    correct: '8',
    explain: 'Primero se multiplica: 3 × 2 = 6. Después 2 + 6 = 8.',
  },
  {
    id: 'mod',
    q: '¿Cuánto sobra al dividir 10 entre 3?',
    code: '10 % 3',
    options: ['3', '1', '0', '3.33'],
    correct: '1',
    explain: '% es el resto de la división. 10 = 3 × 3 + 1, así que el resto es 1.',
  },
];
