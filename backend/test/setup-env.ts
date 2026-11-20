import * as os from 'os';
import * as path from 'path';

// Semua test memakai zona waktu yang sama dengan service (aturan jam masuk / batas absen)
process.env.TZ = 'Asia/Jakarta';
// Foto hasil test e2e ditulis ke folder sementara, bukan ke backend/uploads
process.env.UPLOAD_DIR = path.join(os.tmpdir(), `dexa-wfh-test-uploads-${process.pid}`);
process.env.LOGIN_MAX_ATTEMPTS = '5';
process.env.LOGIN_LOCK_MINUTES = '15';

// Log Nest (sinkron, peringatan Redis) tidak perlu tampil di output test
import { Logger } from '@nestjs/common';
Logger.overrideLogger(false);
