import { serve } from '@hono/node-server';
import { app } from './server';
import { migrate } from './db/migrate';
import { config } from './config';

await migrate();

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`\n  Conviu CRM běží na  http://localhost:${info.port}`);
  console.log(`  První spuštění tě provede založením organizace.\n`);
});
