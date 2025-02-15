import path from 'path';
import ExcelJS from 'exceljs';
import axios from 'axios';
import { logger } from './logger.js';
import { __projectPath, CHAINS, configJson } from './constants.js';
import { HttpProxyAgent } from 'http-proxy-agent';
import { prepareProxyURL } from './misc.js';


async function validateExcelFile() {
    logger.info('Starting excel file validation');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path.join(__projectPath, 'creds.xlsx'));
    const worksheet = workbook.getWorksheet(1);

    let hasError = false;

    for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex++) {
        const row = worksheet.getRow(rowIndex);
        const privateKey = String(row.getCell(1).value || '').trim();
        const isActive = row.getCell(2).value;
        const proxy = String(row.getCell(3).value || '').trim();
        const shouldBridgeETH = row.getCell(5).value;
        const bridgeETHAmount = row.getCell(6).value;
        const bridgeChainFromRaw = String(row.getCell(7).value || '').trim();
        const shouldConnectX = row.getCell(8).value;
        const xSession = String(row.getCell(9).value || '').trim();
        const shouldConnectDiscord = row.getCell(10).value;
        const discordSession = String(row.getCell(11).value || '').trim();

        const pkShort = privateKey.slice(0, 15);
        const rowLabel = `Row ${rowIndex} [${pkShort}]`;

        if (!privateKey) {
            logger.error(`${rowLabel}: privateKey is empty`);
            hasError = true;
            continue;
        }

        const boolFields = [
            { name: 'isActive', value: isActive },
            { name: 'shouldBridgeETH', value: shouldBridgeETH },
            { name: 'shouldConnectX', value: shouldConnectX },
            { name: 'shouldConnectDiscord', value: shouldConnectDiscord }
        ];

        for (const field of boolFields) {
            if (
                field.value !== null &&
                field.value !== undefined &&
                typeof field.value !== 'boolean'
            ) {
                logger.error(`${rowLabel}: ${field.name} must be boolean or empty`);
                hasError = true;
            }
        }

        if (shouldBridgeETH === true) {
            if (!bridgeETHAmount || !bridgeChainFromRaw) {
                logger.error(`${rowLabel}: shouldBridgeETH set, but no bridgeETHAmount or bridgeChainFrom`);
                hasError = true;
            } else {
                const bridgeChainFrom = bridgeChainFromRaw.toUpperCase();
                if (!CHAINS[bridgeChainFrom]) {
                    logger.error(`${rowLabel}: Unknown chain "${bridgeChainFromRaw}" in column bridgeChainFrom`);
                    hasError = true;
                }
            }
        }

        if (shouldConnectX === true && !xSession) {
            logger.error(`${rowLabel}: shouldConnectX set, but xSession is empty`);
            hasError = true;
        }

        if (shouldConnectDiscord === true && !discordSession) {
            logger.error(`${rowLabel}: shouldConnectDiscord set, but discordSession is empty`);
            hasError = true;
        }

        if (proxy) {
            try {
                await validateProxy(proxy);
                logger.debug(`${rowLabel}: Proxy is valid -> ${proxy}`);
            } catch (err) {
                logger.error(`${rowLabel}: Proxy validation failed (${proxy}) -> ${err.message}`);
                hasError = true;
            }
        }

        logger.debug(`${rowLabel}: Row checks completed`);
    }

    if (hasError) {
        logger.error('validateExcelFile: Validation found errors');
        return false;
    } else {
        logger.success('validateExcelFile: All rows validated successfully');
        return true;
    }
}

async function validateProxy(proxyStr) {
    const proxyURL = prepareProxyURL(proxyStr);

    const agent = new HttpProxyAgent(proxyURL);

    const response = await axios.get('https://example.com/', {httpAgent: agent, timeout: 3000});

    if (response.status !== 200) {
        throw new Error(`Invalid status code ${response.status} with proxy ${proxyURL}`);
    }

    return;
}


function validateConfig() {
    logger.info('Starting config validation');
    let hasError = false;

    try {
        const { modules } = configJson;
        if (!modules || typeof modules !== 'object') {
            logger.error(`"modules" is missing or not an object.`);
            hasError = true;
        } else {
            for (const [moduleName, value] of Object.entries(modules)) {
                if (typeof value !== 'boolean') {
                    logger.error(`modules.${moduleName} must be boolean`);
                    hasError = true;
                }
            }
        }

        const bridgeConfig = configJson.bridge;
        if (!bridgeConfig || typeof bridgeConfig !== 'object') {
            logger.error(`"bridge" config is missing or not an object.`);
            hasError = true;
        } else {
            ensureNonNegativeNumber(bridgeConfig.minDelayBetweenWalletsMin, 'bridge.minDelayBetweenWalletsMin');
            ensureNonNegativeNumber(bridgeConfig.maxDelayBetweenWalletsMin, 'bridge.maxDelayBetweenWalletsMin');
            ensureNonNegativeNumber(bridgeConfig.maxRandomAmountDecreasingPercents, 'bridge.maxRandomAmountDecreasingPercents');
        }

        const tradingConfigs = configJson.tradingConfigs;
        if (!tradingConfigs || typeof tradingConfigs !== 'object') {
            logger.error(`"tradingConfigs" is missing or not an object.`);
            hasError = true;
        } else {
            if (!tradingConfigs.absTrade || typeof tradingConfigs.absTrade !== 'object') {
                logger.error(`"tradingConfigs.absTrade" is missing or not an object.`);
                hasError = true;
            } else {
                validateTradeConfig(tradingConfigs.absTrade, 'absTrade');
            }

            if (!tradingConfigs.moonshot || typeof tradingConfigs.moonshot !== 'object') {
                logger.error(`"tradingConfigs.moonshot" is missing or not an object.`);
                hasError = true;
            } else {
                validateTradeConfig(tradingConfigs.moonshot, 'moonshot');
                if (tradingConfigs.moonshot.minETH < 0.001) {
                    logger.error(`"tradingConfigs.moonshot.minETH" must be >= 0.001 (minimum required)`);
                    hasError = true;
                }
            }
        }

        const { absStream } = configJson;
        if (!absStream || typeof absStream !== 'object') {
            logger.error(`"absStream" is missing or not an object.`);
            hasError = true;
        } else {
            ensureNonNegativeNumber(absStream.minWatchTimeMin, 'absStream.minWatchTimeMin');
            ensureNonNegativeNumber(absStream.maxWatchTimeMin, 'absStream.maxWatchTimeMin');
            ensureNonNegativeNumber(absStream.ethTipSizeMin, 'absStream.ethTipSizeMin');
            ensureNonNegativeNumber(absStream.ethTipSizeMax, 'absStream.ethTipSizeMax');

            if (absStream.minWatchTimeMin > absStream.maxWatchTimeMin) {
                logger.error(`"absStream.minWatchTimeMin" must not exceed "absStream.maxWatchTimeMin"`);
                hasError = true;
            }
            if (absStream.ethTipSizeMin > absStream.ethTipSizeMax) {
                logger.error(`"absStream.ethTipSizeMin" must not exceed "absStream.ethTipSizeMax"`);
                hasError = true;
            }
        }

        if (!Array.isArray(configJson.delayLevelsSec)) {
            logger.error(`"delayLevelsSec" must be an array`);
            hasError = true;
        } else {
            configJson.delayLevelsSec.forEach((level, idx) => {
                if (
                    typeof level.min !== 'number' ||
                    typeof level.max !== 'number' ||
                    level.min < 0 ||
                    level.max < 0
                ) {
                    logger.error(`"delayLevelsSec[${idx}]": min/max must be non-negative numbers`);
                    hasError = true;
                }
                if (level.min > level.max) {
                    logger.error(`"delayLevelsSec[${idx}]": min must not exceed max`);
                    hasError = true;
                }
            });
        }
    } catch (err) {
        logger.error(`Config validation encountered an exception: ${err.message}`);
        return false;
    }

    if (hasError) {
        logger.error('Config validation found errors');
        return false;
    } else {
        logger.success('Config validation passed successfully');
        return true;
    }
}

function ensureNonNegativeNumber(value, label) {
    if (typeof value !== 'number' || isNaN(value)) {
        throw new Error(`"${label}" must be a valid number`);
    }
    if (value < 0) {
        throw new Error(`"${label}" must be non-negative`);
    }
}

function validateTradeConfig(configPart, label) {
    ensureNonNegativeNumber(configPart.minETH, `tradingConfigs.${label}.minETH`);
    ensureNonNegativeNumber(configPart.maxETH, `tradingConfigs.${label}.maxETH`);
    ensureNonNegativeNumber(configPart.nTransactionsMin, `tradingConfigs.${label}.nTransactionsMin`);
    ensureNonNegativeNumber(configPart.nTransactionsMax, `tradingConfigs.${label}.nTransactionsMax`);
    ensureNonNegativeNumber(configPart.minDelayBetweenBuyAndSellSec, `tradingConfigs.${label}.minDelayBetweenBuyAndSellSec`);
    ensureNonNegativeNumber(configPart.maxDelayBetweenBuyAndSellSec, `tradingConfigs.${label}.maxDelayBetweenBuyAndSellSec`);

    if (configPart.minETH > configPart.maxETH) {
        throw new Error(`"tradingConfigs.${label}.minETH" must not exceed "tradingConfigs.${label}.maxETH"`);
    }
    if (configPart.nTransactionsMin > configPart.nTransactionsMax) {
        throw new Error(`"tradingConfigs.${label}.nTransactionsMin" must not exceed "tradingConfigs.${label}.nTransactionsMax"`);
    }
}

export { validateExcelFile, validateConfig }
