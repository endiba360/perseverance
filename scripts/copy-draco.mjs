// Copia el decodificador Draco de three.js a public/draco/ (corre en postinstall).
// Así la versión siempre coincide con la de three instalada y no depende de un CDN.
import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../node_modules/three/examples/jsm/libs/draco/gltf/', import.meta.url));
const target = fileURLToPath(new URL('../public/draco/', import.meta.url));

await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
console.log('Decodificador Draco copiado a public/draco/');
