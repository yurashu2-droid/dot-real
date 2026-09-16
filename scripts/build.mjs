import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
await rm(output, { recursive: true, force: true }); await mkdir(output, { recursive: true });
for (const entry of ['index.html', 'styles.css', 'src', 'assets', 'THIRD_PARTY_NOTICES.md']) await cp(path.join(root, entry), path.join(output, entry), { recursive: true });
await writeFile(path.join(output, '.nojekyll'), '');
console.log('Built static site → dist/ (no camera data or secrets included)');
