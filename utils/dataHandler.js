import fs from 'fs';
import { stateJson, stateFilePath } from './constants.js';
import { logger } from './logger.js';

function checkIsWalletExists(privateKey) {
    return Object.prototype.hasOwnProperty.call(stateJson, privateKey);
}

function updateState(privateKey, stateKey, stateValue) {
    const pkShort = privateKey.slice(0, 15);

    if (!checkIsWalletExists(privateKey)) {
        stateJson[privateKey] = {};
        logger.debug(`[${pkShort}] Created new object in state for this private key`);
    }

    stateJson[privateKey][stateKey] = stateValue;
    logger.debug(`[${pkShort}] Updated data: "${stateKey}" = "${stateValue}"`);

    fs.writeFileSync(stateFilePath, JSON.stringify(stateJson, null, 2), 'utf-8');
    logger.debug(`[${pkShort}] state.json updated ( ${stateKey} = ${stateValue} )`);
}

export { checkIsWalletExists, updateState };
