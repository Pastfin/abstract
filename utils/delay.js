import { configJson } from './constants.js';
import { logger } from './logger.js';

export async function waitDelay(level) {
    const { min, max } = configJson.delayLevelsSec[level];
    const randomSec = Math.random() * (max - min) + min;
    const ms = randomSec * 1000;

    logger.debug(`Waiting ~${randomSec.toFixed(2)} seconds (delay level: ${level})`);
    await new Promise(resolve => setTimeout(resolve, ms));
    return;
}

