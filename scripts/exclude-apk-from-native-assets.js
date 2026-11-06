import { rm } from 'node:fs/promises';

await rm('dist/downloads/SanturBio.apk', { force: true });
