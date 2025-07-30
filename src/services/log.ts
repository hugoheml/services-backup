import "dotenv/config";
import winston from "winston";

const { LOG_LEVEL } = process.env;

export const logger = winston.createLogger({
	level: LOG_LEVEL || 'info',
	format: winston.format.combine(
		winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
		winston.format.printf(({ timestamp, level, message }) => {
			return `[${timestamp}] ${level}: ${message}`;
		})
	),
	transports: [
		new winston.transports.Console({
			format: winston.format.combine(
				winston.format.colorize(),
				winston.format.printf(({ timestamp, level, message }) => {
					return `[${timestamp}] ${level}: ${message}`;
				})
			)
		}),
	]
});