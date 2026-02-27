type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
};

let worker: Worker | null = null;
let msgId = 0;
const pending = new Map<number, Pending>();
let dbInitialized = false;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('./database.worker.ts', import.meta.url),
      { type: 'module' }
    );
    worker.addEventListener('message', (e: MessageEvent) => {
      const { id, result, error } = e.data as {
        id: number;
        result?: unknown;
        error?: string;
      };
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (error) p.reject(new Error(error));
      else p.resolve(result);
    });
  }
  return worker;
}

function call(action: string, args: unknown[] = []): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, action, args });
  });
}

export async function initDB(): Promise<{ warning?: string }> {
  if (dbInitialized) return {};
  const result = (await call('init')) as { ok: true; warning?: string };
  if (result.warning) {
    console.warn('[DB] initDB warning:', result.warning);
  }
  dbInitialized = true;
  return { warning: result.warning };
}

export async function queryDB<T = unknown[]>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  return call('query', [sql, params]) as Promise<T[]>;
}

export async function executeDB(
  sql: string,
  params: unknown[] = []
): Promise<{ changes: number; lastId?: number }> {
  return call('execute', [sql, params]) as Promise<{
    changes: number;
    lastId?: number;
  }>;
}

export async function saveDB(): Promise<void> {
  await call('save', []);
}
