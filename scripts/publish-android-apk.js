import { copyFile, mkdir } from 'node:fs/promises';

const apkPath = 'android/app/build/outputs/apk/debug/app-debug.apk';
const downloadPath = 'public/downloads/SanturBio.apk';

await mkdir('public/downloads', { recursive: true });
await mkdir('dist/downloads', { recursive: true });
await copyFile(apkPath, downloadPath);
await copyFile(apkPath, 'dist/downloads/SanturBio.apk');
