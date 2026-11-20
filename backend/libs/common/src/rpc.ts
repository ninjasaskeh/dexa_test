import { HttpException, HttpStatus, INestMicroservice, Logger } from '@nestjs/common';
import { ClientProxy, RpcException, Transport } from '@nestjs/microservices';
import { NestFactory } from '@nestjs/core';
import { firstValueFrom, timeout } from 'rxjs';
import { AllRpcExceptionsFilter } from './rpc-exception.filter';

/** Dipakai di dalam microservice: lempar error yang membawa HTTP status. */
export function rpcError(statusCode: number, message: string): never {
  throw new RpcException({ statusCode, message });
}

/**
 * Kirim request ke microservice lewat TCP dan ubah error RPC menjadi HttpException.
 */
export async function sendRpc<T = any>(client: ClientProxy, pattern: string, data: unknown): Promise<T> {
  try {
    return await firstValueFrom(client.send<T>(pattern, data ?? {}).pipe(timeout(8000)));
  } catch (err: any) {
    if (err instanceof HttpException) throw err;
    if (err?.name === 'TimeoutError' || err?.code === 'ECONNREFUSED') {
      throw new HttpException(`Service tidak dapat dihubungi (${pattern})`, HttpStatus.SERVICE_UNAVAILABLE);
    }
    const status = typeof err?.statusCode === 'number' ? err.statusCode : HttpStatus.INTERNAL_SERVER_ERROR;
    throw new HttpException(err?.message ?? 'Terjadi kesalahan pada service', status);
  }
}

/** Bootstrap microservice TCP standar */
export async function bootstrapTcpService(module: any, name: string, hostEnv: string, portEnv: string, defaultPort: number) {
  process.env.TZ ??= 'Asia/Jakarta';
  const host = process.env[hostEnv] ?? '127.0.0.1';
  const port = Number(process.env[portEnv] ?? defaultPort);
  const app: INestMicroservice = await NestFactory.createMicroservice(module, {
    transport: Transport.TCP,
    options: { host, port },
  });
  app.useGlobalFilters(new AllRpcExceptionsFilter());
  app.enableShutdownHooks();
  await app.listen();
  new Logger(name).log(`🚀 ${name} listening on tcp://${host}:${port}`);
}
