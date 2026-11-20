import { ArgumentsHost, Catch, HttpException, Logger, RpcExceptionFilter } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';

/**
 * Filter global microservice: semua error diubah menjadi { statusCode, message }
 * agar gateway bisa meneruskan HTTP status yang tepat.
 */
@Catch()
export class AllRpcExceptionsFilter implements RpcExceptionFilter<unknown> {
  private readonly logger = new Logger('RpcException');

  catch(exception: any, _host: ArgumentsHost): Observable<never> {
    if (exception instanceof RpcException) {
      const err = exception.getError();
      return throwError(() => (typeof err === 'object' ? err : { statusCode: 500, message: err }));
    }
    if (exception instanceof HttpException) {
      return throwError(() => ({ statusCode: exception.getStatus(), message: exception.message }));
    }
    if (exception?.code === 'ER_DUP_ENTRY') {
      return throwError(() => ({ statusCode: 409, message: 'Data sudah ada (duplikat)' }));
    }
    this.logger.error(exception?.message ?? exception, exception?.stack);
    return throwError(() => ({ statusCode: 500, message: 'Terjadi kesalahan pada server' }));
  }
}
