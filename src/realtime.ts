/**
 * Realtime spolupráce (zásada: změny se hned projeví všem).
 * Jednoduchý in-memory event bus → SSE stream /live. Každá doménová událost
 * (logEvent) se vysílá všem připojeným oknům; živé zóny v UI se samy překreslí
 * (hx-trigger="live-update from:body"). Při škálování lze vyměnit za Redis pub/sub.
 */

type Send = (data: string) => void | Promise<void>;

const clients = new Set<Send>();

export function addClient(send: Send): void {
  clients.add(send);
}

export function removeClient(send: Send): void {
  clients.delete(send);
}

export function clientCount(): number {
  return clients.size;
}

/** Pošle událost všem připojeným klientům (oknům prohlížeče). */
export function broadcast(payload: Record<string, unknown>): void {
  const data = JSON.stringify(payload);
  for (const send of clients) {
    try {
      void send(data);
    } catch {
      clients.delete(send);
    }
  }
}
