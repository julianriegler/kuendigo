/**
 * Logiktest für utils/resultStore.ts ohne Expo/Metro.
 *
 * Store und Speicher-Adapter werden 1:1 kopiert, nur die beiden Plattform-Importe
 * (react-native, AsyncStorage) zeigen auf ./shim.ts. Danach läuft der Test in Node.
 *
 *   npm run test:store
 */
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const generated = [join(here, 'resultStore.gen.ts'), join(here, 'kvStorage.gen.ts')];

const patchPlatform = src => src
  .replace("import { Platform } from 'react-native';", "import { Platform } from './shim.ts';")
  .replace(
    "import AsyncStorage from '@react-native-async-storage/async-storage';",
    "import AsyncStorage from './shim.ts';",
  );

writeFileSync(
  generated[0],
  patchPlatform(readFileSync(join(root, 'utils', 'resultStore.ts'), 'utf8'))
    .replace("from './kvStorage'", "from './kvStorage.gen.ts'"),
);
writeFileSync(
  generated[1],
  patchPlatform(readFileSync(join(root, 'utils', 'kvStorage.ts'), 'utf8')),
);

const run = spawnSync(
  process.execPath,
  ['--experimental-strip-types', '--no-warnings', join(here, 'run.ts')],
  { stdio: 'inherit' },
);

generated.forEach(f => rmSync(f, { force: true }));
process.exit(run.status ?? 1);
