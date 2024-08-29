import { createLogger, transports, format } from 'winston';

const logFormat = format.printf(
  ({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}] : ${message} `;
    if (metadata && Object.keys(metadata).length > 0) {
      msg += JSON.stringify(metadata);
    }
    return msg;
  }
);

export default createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(format.colorize(), format.timestamp(), logFormat),
  transports: [new transports.Console()]
});
