import { createLogger, transports, format } from 'winston';

export default createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(format.colorize(), format.simple()),
  transports: [new transports.Console()]
});
