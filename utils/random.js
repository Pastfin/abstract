import { logger } from './logger.js';

async function randomDelay(minSec, maxSec) {
    const minMs = minSec * 1000;
    const maxMs = maxSec * 1000;
    const ms = randBetween(minMs, maxMs);
    logger.debug(`Waiting ~${ms.toFixed(2)} ms`);
    await new Promise(resolve => setTimeout(resolve, ms));
    return;
}

function randBetween(min, max) {
    const res = Math.random() * (max - min) + min;
    logger.debug(`rand value: ${res}`);
    return res;
}

export { randomDelay, randBetween }