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
// resultStore.ts zieht seit den Erinnerungen vor Abbuchung zusätzlich
// storage (Reminder-Settings) und reminders (Neuplanung bei jeder Mutation),
// reminders.ts wiederum reminderPlan: alle drei müssen mitkopiert und
// umgebogen werden, sonst bricht der Import mit ERR_MODULE_NOT_FOUND ab.
const MODULES = ['kvStorage', 'reminderPlan', 'storage', 'reminders', 'resultStore', 'consent'];
const generated = MODULES.map(name => join(here, `${name}.gen.ts`));

const patch = src => src
  .replace("import { Platform } from 'react-native';", "import { Platform } from './shim.ts';")
  .replace(
    "import AsyncStorage from '@react-native-async-storage/async-storage';",
    "import AsyncStorage from './shim.ts';",
  )
  .replace(/from '\.\/kvStorage'/g, "from './kvStorage.gen.ts'")
  .replace(/from '\.\/reminderPlan'/g, "from './reminderPlan.gen.ts'")
  .replace(/from '\.\/storage'/g, "from './storage.gen.ts'")
  .replace(/from '\.\/reminders'/g, "from './reminders.gen.ts'");

MODULES.forEach((name, i) => {
  writeFileSync(generated[i], patch(readFileSync(join(root, 'utils', `${name}.ts`), 'utf8')));
});

const run = spawnSync(
  process.execPath,
  ['--experimental-strip-types', '--no-warnings', join(here, 'run.ts')],
  { stdio: 'inherit' },
);

generated.forEach(f => rmSync(f, { force: true }));
process.exit(run.status ?? 1);
