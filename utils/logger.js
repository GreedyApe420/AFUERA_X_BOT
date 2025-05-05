import { createLogger, format, transports } from 'winston';
import path from 'path';

const logger = createLogger({
  level: 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(info => `[${info.timestamp}] ${info.level.toUpperCase()}: ${info.message}`)
  ),
  transports: [
    new transports.Console({ level: 'info' }),
    new transports.File({
      filename: path.resolve('./bot.log'),
      level: 'debug',
      maxsize: 1048576,
      maxFiles: 5,
      tailable: true
    })
  ]
});

export default logger;
