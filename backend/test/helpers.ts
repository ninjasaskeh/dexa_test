import { ClientProxy, RpcException } from '@nestjs/microservices';
import { FindOperator } from 'typeorm';
import { Observable, of, throwError } from 'rxjs';

/**
 * Bekukan jam (hanya objek Date) di waktu Asia/Jakarta, mis. setNow('2026-11-20 10:00').
 * Timer lain tetap asli agar rxjs/promise berjalan normal.
 */
export function setNow(local: string) {
  jest.useFakeTimers({
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask', 'hrtime', 'performance'],
  });
  jest.setSystemTime(new Date(`${local.replace(' ', 'T')}:00+07:00`));
}

export function restoreTime() {
  jest.useRealTimers();
}

type Handler = (data: any) => unknown;

/**
 * ClientProxy palsu: setiap pattern TCP dijawab oleh handler. Handler boleh mengembalikan nilai,
 * Promise, atau melempar `{ statusCode, message }` (sama seperti balasan error microservice asli).
 */
export function fakeClient(handlers: Record<string, Handler> = {}) {
  const calls: { pattern: string; data: any }[] = [];
  const client = {
    calls,
    handlers,
    send: jest.fn((pattern: string, data: unknown): Observable<unknown> => {
      calls.push({ pattern, data });
      const h = handlers[pattern];
      if (!h) return throwError(() => ({ statusCode: 500, message: `pattern ${pattern} tidak di-mock` }));
      try {
        const v = h(data);
        return v instanceof Promise ? new Observable((s) => void v.then((x) => { s.next(x); s.complete(); }, (e) => s.error(e))) : of(v);
      } catch (e) {
        return throwError(() => e);
      }
    }),
    emit: jest.fn(() => of(undefined)),
    connect: jest.fn(async () => undefined),
    close: jest.fn(),
  };
  return client as typeof client & ClientProxy;
}

/** Ambil { statusCode, message } dari RpcException yang dilempar rpcError() */
export async function rpcErrorOf(p: Promise<unknown> | (() => unknown)): Promise<{ statusCode: number; message: string }> {
  try {
    await (typeof p === 'function' ? p() : p);
  } catch (e) {
    if (e instanceof RpcException) return e.getError() as { statusCode: number; message: string };
    throw e;
  }
  throw new Error('Diharapkan melempar RpcException, tetapi berhasil');
}

/** Query builder TypeORM palsu: semua method chain mengembalikan dirinya, method akhir di-mock */
export function fakeQb(result: Partial<Record<'getOne' | 'getMany' | 'getManyAndCount' | 'getRawMany' | 'getExists', unknown>> = {}) {
  const qb: any = new Proxy(
    {},
    {
      get(target: any, prop: string) {
        if (prop in target) return target[prop];
        if (prop in result) return (target[prop] = jest.fn(async () => (result as any)[prop]));
        if (prop === 'then') return undefined;
        return (target[prop] = jest.fn(() => qb));
      },
    },
  );
  return qb;
}

/** Redis palsu di memori: cukup untuk perintah yang dipakai aplikasi (get/set NX EX/mget/incr/ttl/del/multi/eval) */
export class FakeRedis {
  store = new Map<string, { value: string; expireAt: number | null }>();
  down = false;

  private check() {
    if (this.down) throw new Error("Stream isn't writeable and enableOfflineQueue options is false");
  }

  private live(key: string) {
    const e = this.store.get(key);
    if (e && e.expireAt !== null && e.expireAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return e;
  }

  async get(key: string) {
    this.check();
    return this.live(key)?.value ?? null;
  }

  async set(key: string, value: string | number, ...args: (string | number)[]) {
    this.check();
    return this.setSync(key, value, ...args);
  }

  private setSync(key: string, value: string | number, ...args: (string | number)[]) {
    const nx = args.includes('NX');
    const exIdx = args.indexOf('EX');
    if (nx && this.live(key)) return null;
    const expireAt = exIdx >= 0 ? Date.now() + Number(args[exIdx + 1]) * 1000 : null;
    this.store.set(key, { value: String(value), expireAt });
    return 'OK';
  }

  private incrSync(key: string) {
    const e = this.live(key);
    const n = Number(e?.value ?? 0) + 1;
    this.store.set(key, { value: String(n), expireAt: e?.expireAt ?? null });
    return n;
  }

  async mget(...keys: string[]) {
    this.check();
    return keys.map((k) => this.live(k)?.value ?? null);
  }

  async ttl(key: string) {
    this.check();
    const e = this.live(key);
    if (!e) return -2;
    return e.expireAt === null ? -1 : Math.ceil((e.expireAt - Date.now()) / 1000);
  }

  async del(...keys: string[]) {
    this.check();
    return keys.filter((k) => this.store.delete(k)).length;
  }

  async eval(_script: string, _n: number, key: string, token: string) {
    this.check();
    if (this.live(key)?.value === token) {
      this.store.delete(key);
      return 1;
    }
    return 0;
  }

  async ping() {
    this.check();
    return 'PONG';
  }

  async quit() {
    return 'OK';
  }

  disconnect() {}

  multi() {
    const ops: (() => unknown)[] = [];
    const chain = {
      set: (key: string, value: string | number, ...args: (string | number)[]) => (ops.push(() => this.setSync(key, value, ...args)), chain),
      incr: (key: string) => (ops.push(() => this.incrSync(key)), chain),
      exec: async () => {
        this.check();
        return ops.map((op) => [null, op()]);
      },
    };
    return chain;
  }
}

/** ConfigService palsu dengan nilai tetap */
export function fakeConfig(values: Record<string, string> = {}) {
  return { get: (key: string, def?: unknown) => (key in values ? values[key] : def) } as any;
}

/** Cocokkan satu kondisi `where` TypeORM sederhana (nilai biasa, Between, In) */
function matches(row: any, where: Record<string, any>) {
  return Object.entries(where).every(([k, cond]) => {
    if (cond instanceof FindOperator) {
      const v = cond.value as any;
      if (cond.type === 'between') return row[k] >= v[0] && row[k] <= v[1];
      if (cond.type === 'in') return v.includes(row[k]);
      throw new Error(`FindOperator ${cond.type} belum didukung di memRepo`);
    }
    return row[k] === cond;
  });
}

/**
 * Repository palsu di memori untuk find/findBy/findOneBy/save/create/update/delete/insert.
 * Cukup untuk menguji aturan bisnis service tanpa MySQL.
 */
export function memRepo<T extends { id?: number }>(initial: Partial<T>[] = []) {
  let nextId = Math.max(0, ...initial.map((r) => r.id ?? 0)) + 1;
  const rows: any[] = initial.map((r) => ({ ...r }));
  const where = (w: any) => (Array.isArray(w) ? w : [w ?? {}]);
  const repo = {
    rows,
    create: jest.fn((data: any) => ({ ...data })),
    save: jest.fn(async (data: any) => {
      if (data.id) {
        const i = rows.findIndex((r) => r.id === data.id);
        rows[i] = { ...rows[i], ...data };
        return rows[i];
      }
      const row = { id: nextId++, createdAt: new Date(), updatedAt: new Date(), ...data };
      rows.push(row);
      return { ...row };
    }),
    insert: jest.fn(async (data: any) => {
      rows.push({ id: nextId++, ...data });
      return { identifiers: [{ id: nextId - 1 }] };
    }),
    find: jest.fn(async (opts: any = {}) => rows.filter((r) => where(opts.where).some((w: any) => matches(r, w))).map((r) => ({ ...r }))),
    findBy: jest.fn(async (w: any) => rows.filter((r) => where(w).some((x: any) => matches(r, x))).map((r) => ({ ...r }))),
    findOneBy: jest.fn(async (w: any) => {
      const r = rows.find((x) => matches(x, w));
      return r ? { ...r } : null;
    }),
    existsBy: jest.fn(async (w: any) => rows.some((x) => matches(x, w))),
    /** update bersyarat seperti MySQL: affected = jumlah baris yang cocok */
    update: jest.fn(async (crit: any, patch: any) => {
      const w = typeof crit === 'number' ? { id: crit } : crit;
      const hit = rows.filter((r) => matches(r, w));
      hit.forEach((r) => Object.assign(r, patch));
      return { affected: hit.length };
    }),
    delete: jest.fn(async (crit: any) => {
      const w = typeof crit === 'number' ? { id: crit } : crit;
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i], w)) rows.splice(i, 1);
      return { affected: before - rows.length };
    }),
  };
  return repo;
}
