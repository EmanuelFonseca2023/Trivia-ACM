import { BASIC } from './basic.js';
import { STORIES } from './stories.js';

// Para sumar una pregunta, agrégala en stories.js con el topic de esa puerta.
// basic.js solo guarda dos ejercicios que el autotest comprueba y el juego no pregunta.
export const QUESTIONS = [...BASIC, ...STORIES];
