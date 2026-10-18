import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');

await rm(dist, { recursive: true, force: true });
await cp(join(root, 'extension'), dist, { recursive: true });
await build({
  entryPoints: [join(root, 'src/background.ts')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'chrome120',
  outfile: join(dist, 'lib/background.mjs'),
  logLevel: 'info',
});
console.log(`Built unpacked extension: ${dist}`);
