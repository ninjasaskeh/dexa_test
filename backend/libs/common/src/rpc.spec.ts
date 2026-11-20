import { HttpException, HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { fakeClient } from '../../../test/helpers';
import { rpcError, sendRpc } from './rpc';
import { withEmployees } from './employees';

async function httpErrorOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(HttpException);
    const err = e as HttpException;
    return { status: err.getStatus(), message: err.message };
  }
  throw new Error('Diharapkan gagal');
}

describe('sendRpc (gateway -> microservice)', () => {
  it('mengembalikan balasan service', async () => {
    const client = fakeClient({ ping: (d) => ({ echo: d }) });
    await expect(sendRpc(client, 'ping', { a: 1 })).resolves.toEqual({ echo: { a: 1 } });
  });

  it('error dari service dibawa dengan status HTTP yang sama', async () => {
    const client = fakeClient({ x: () => { throw { statusCode: 409, message: 'Anda sudah check-in hari ini' }; } });
    await expect(httpErrorOf(sendRpc(client, 'x', {}))).resolves.toEqual({ status: 409, message: 'Anda sudah check-in hari ini' });
  });

  it('service mati (ECONNREFUSED) atau timeout menjadi 503', async () => {
    const refused = fakeClient({ x: () => { throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }); } });
    expect((await httpErrorOf(sendRpc(refused, 'x', {}))).status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    const slow = fakeClient({ x: () => { throw Object.assign(new Error('Timeout'), { name: 'TimeoutError' }); } });
    expect((await httpErrorOf(sendRpc(slow, 'x', {}))).status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
  });

  it('error tanpa status menjadi 500', async () => {
    const client = fakeClient({ x: () => { throw new Error('boom'); } });
    expect((await httpErrorOf(sendRpc(client, 'x', {}))).status).toBe(500);
  });

  it('rpcError melempar RpcException berisi statusCode', () => {
    try {
      rpcError(404, 'Tidak ditemukan');
    } catch (e) {
      expect(e).toBeInstanceOf(RpcException);
      expect((e as RpcException).getError()).toEqual({ statusCode: 404, message: 'Tidak ditemukan' });
    }
  });
});

describe('withEmployees', () => {
  it('menempelkan data karyawan dengan satu panggilan untuk id unik', async () => {
    const client = fakeClient({
      'employee.find_by_ids': ({ ids }) => ids.filter((id: number) => id !== 9).map((id: number) => ({ id, nip: `E${id}`, fullName: `Nama ${id}`, department: 'IT', position: 'Dev', phone: 'rahasia' })),
    });
    const rows = await withEmployees(client, [{ employeeId: 1 }, { employeeId: 1 }, { employeeId: 9 }]);
    expect(client.calls).toEqual([{ pattern: 'employee.find_by_ids', data: { ids: [1, 9] } }]);
    expect(rows[0].employee).toEqual({ id: 1, nip: 'E1', fullName: 'Nama 1', department: 'IT', position: 'Dev' });
    expect(rows[2].employee).toBeNull(); // karyawan sudah dihapus
  });

  it('tidak memanggil employee-service bila daftar kosong', async () => {
    const client = fakeClient();
    await expect(withEmployees(client, [])).resolves.toEqual([]);
    expect(client.send).not.toHaveBeenCalled();
  });
});
