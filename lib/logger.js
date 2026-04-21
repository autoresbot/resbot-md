import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import config from '../config.js';

function safeSerialize(value) {
  if (typeof value === 'string') return value;

  if (value instanceof Error) {
    return value.stack || value.message || String(value);
  }

  const seen = new WeakSet();
  try {
    return JSON.stringify(
      value,
      (key, val) => {
        if (typeof val === 'object' && val !== null) {
          if (seen.has(val)) return '[Circular]';
          seen.add(val);
        }
        return val;
      },
      2,
    );
  } catch {
    return String(value);
  }
}

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(
      ({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`,
    ),
  ),
  transports: [
    new DailyRotateFile({
      filename: 'tmp/logs/bot-activity-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m', // Maksimal ukuran file log 10MB
      maxFiles: '14d', // Simpan log selama 14 hari
    }),
  ],
});

// Fungsi kustom untuk mencatat log
function logCustom(level, message, filename = null) {
  if (config.mode != 'development') return;

  const normalizedMessage = safeSerialize(message);

  if (filename) {
    // Buat logger sementara untuk file yang ditentukan
    const tempLogger = createLogger({
      level: level,
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(
          ({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`,
        ),
      ),
      transports: [
        new transports.File({
          filename: `tmp/logs/${filename}`, // Buat atau gunakan file log yang sudah ada
          level: level,
        }),
      ],
    });

    // Gunakan logger sementara untuk mencatat log
    tempLogger.log(level, normalizedMessage);
  } else {
    // Gunakan logger utama jika tidak ada filename
    logger.log(level, normalizedMessage);
  }
}

export { logger, logCustom };
