import winston from 'winston';
import { logFilePath } from './constants.js';

const customLevels = {
    levels: {
        error: 0,
        warn: 1,
        success: 2,
        info: 3,
        debug: 4
    },
    colors: {
        error: 'red',
        warn: 'yellow',
        success: 'green',
        info: 'white',
        debug: 'white'
    }
};

winston.addColors(customLevels.colors);

const fileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
        return `[${timestamp}] ${level}: ${message}`;
    })
);

const consoleFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => {
        return `[${timestamp}] ${level}: ${message}`;
    })
);

export const logger = winston.createLogger({
    levels: customLevels.levels,
    level: 'info',
    transports: [
        new winston.transports.Console({
            format: consoleFormat
        }),
        new winston.transports.File({
            filename: logFilePath,
            format: fileFormat
        })
    ]
});
