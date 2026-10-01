import { JSDOM } from 'jsdom';
import fs from 'fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  .replace(/<script[\s\S]*<\/script>/, '');
const dom = new JSDOM(html, {
  url: 'http://127.0.0.1/index.html?autotest=1',
  pretendToBeVisual: true,
});
const { window } = dom;
const canvas = window.document.getElementById('c');
canvas.getContext = () => new Proxy({}, { get: () => () => {}, set: () => true });

globalThis.document = window.document;
globalThis.localStorage = window.localStorage;
globalThis.location = window.location;
globalThis.innerWidth = window.innerWidth || 1280;
globalThis.innerHeight = window.innerHeight || 800;
globalThis.matchMedia = window.matchMedia
  ? window.matchMedia.bind(window)
  : () => ({ matches: false });
globalThis.addEventListener = window.addEventListener.bind(window);
globalThis.requestAnimationFrame = () => 0;

await import('../src/game.js');

const result = globalThis.document.getElementById('test-result');
const text = result ? result.textContent : 'NO RESULT';
console.log(text);
if (!text.startsWith('PASS')) process.exit(1);
