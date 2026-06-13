import { serve } from '@hono/node-server';
import { app } from './server';
import { migrate } from './db/migrate';
import { seed } from './db/seed';
import { config } from './config';

await migrate();
await seed();

/**
 * Start s tolerancí: při restartu (tsx watch) může starý proces port ještě
 * chvíli držet — EADDRINUSE proto pár vteřin zkoušíme znovu, místo pádu.
 */
function listen(attempt = 1): void {
  const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.log(`\n  Trefoil CRM běží na  http://localhost:${info.port}`);
    console.log(`  První spuštění tě provede založením organizace.\n`);
  });
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE' && attempt < 20) {
      if (attempt === 1) console.log(`  Port ${config.port} je ještě obsazený — zkouším znovu…`);
      setTimeout(() => listen(attempt + 1), 500);
      return;
    }
    throw err;
  });
}
listen();
