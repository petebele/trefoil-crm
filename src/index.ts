import { serve } from '@hono/node-server';
import { app } from './server';
import { migrate } from './db/migrate';
import { seed } from './db/seed';
import { cleanupExpiredSessions } from './auth/session';
import { config } from './config';

try {
  await migrate();
  await seed();
  await cleanupExpiredSessions();
} catch (err) {
  console.error('\n  Inicializace databáze selhala — aplikace se nespustí.');
  console.error('  Důvod:', err instanceof Error ? err.message : err);
  process.exit(1);
}

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
