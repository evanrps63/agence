// npm test : lance chaque test à la suite
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ici = path.dirname(fileURLToPath(import.meta.url));
let echec = false;
for (const f of fs.readdirSync(ici).filter(f => /^test-.*\.mjs$/.test(f)).sort()) {
  console.log(`\n=== ${f}`);
  const r = spawnSync(process.execPath, [path.join(ici, f)], { stdio: 'inherit', timeout: 180000 });
  if (r.status !== 0) echec = true;
}
console.log(echec ? '\nAu moins un test a échoué.' : '\nTous les tests passent.');
process.exit(echec ? 1 : 0);
