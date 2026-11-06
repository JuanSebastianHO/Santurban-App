import { copyFile, mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await copyFile('service-worker.js', 'dist/service-worker.js');
await mkdir('dist/assets/icons', { recursive: true });
await copyFile('assets/icons/app-icon.svg', 'dist/assets/icons/app-icon.svg');
