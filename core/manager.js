import { configJson, __projectPath, CHAINS } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
import { waitDelay } from '../utils/delay.js';
import { randomDelay } from '../utils/random.js';
import Web3 from 'web3';
import { getNativeBalance } from '../utils/balance.js';
import ExcelJS from 'exceljs';
import path from 'path';
import { loadBrowser } from '../utils/browser.js';
import { checkIsWalletExists } from '../utils/dataHandler.js';

import { login } from '../utils/abs.js';
import { claimAllBadges } from '../modules/absClaimBadge.js';
import { watchStream } from '../modules/absStream.js';
import { tradeOnSite } from '../modules/absTrade.js';
import { upvote } from '../modules/absUpvote.js';
import { bridgeToAbstract } from '../modules/bridge.js';
import { initWalletInMoonshot, tradeMoonshot } from '../modules/moonshot.js';
import { initMetamask } from '../utils/metamask.js';

async function start() {
    try {
        logger.info('Starting main workflow');

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(path.join(__projectPath, 'creds.xlsx'));
        const worksheet = workbook.getWorksheet(1);

        let rowNumbers = Array.from({ length: worksheet.rowCount - 1 }, (_, i) => i + 2);

        rowNumbers = shuffleArray(rowNumbers);

        await manageNewAccountsInSoft(worksheet, rowNumbers);

        if (configJson.modules.bridge) {
            rowNumbers = shuffleArray(rowNumbers);
            await manageBridge(worksheet, rowNumbers);
        }

        rowNumbers = shuffleArray(rowNumbers);
        await manageActivities(worksheet, rowNumbers);

        logger.info('Main workflow finished');
    } catch (err) {
        logger.error(`start() error: ${err.message}`);
    }
}

async function manageBridge(worksheet, rowNumbers) {
    const web3 = new Web3();
    for (const rowIndex of rowNumbers) {
        const row = worksheet.getRow(rowIndex);
        const isActive = row.getCell(2).value;
        if (!isActive) {
            continue;
        }
        const shouldBridgeETH = row.getCell(5).value;
        if (!shouldBridgeETH) {
            continue;
        }

        const privateKey = String(row.getCell(1).value || '').trim();
        const normalizedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

        const proxy = String(row.getCell(3).value || '').trim();
        const bridgeETHAmount = Number(row.getCell(6).value || 0);
        const chainFromRaw = String(row.getCell(7).value || '').toUpperCase();
        const pkShort = privateKey.slice(0, 15);

        logger.info(`[${pkShort}] Attempting to bridge from row ${rowIndex}`);
        const chainData = CHAINS[chainFromRaw];
        if (!chainData) {
            logger.error(`[${pkShort}] Unknown chain: ${chainFromRaw}`);
            continue;
        }

        const rpc = chainData.rpc;

        try {
            logger.debug(`[${pkShort}] Starting bridge process with RPC: ${rpc}`);
            
            const maxDecrease = configJson.bridge.maxRandomAmountDecreasingPercents / 100;
            const randomDecreaseFactor = Math.random() * maxDecrease;
            logger.debug(`[${pkShort}] Random decrease factor: ${randomDecreaseFactor.toFixed(4)}`);
            
            let newBridgeAmount = bridgeETHAmount * (1 - randomDecreaseFactor);
            logger.debug(`[${pkShort}] Initial bridge amount: ${bridgeETHAmount}, new amount after decrease: ${newBridgeAmount}`);
        
            const account = web3.eth.accounts.privateKeyToAccount(normalizedPrivateKey);
            logger.debug(`[${pkShort}] Account address: ${account.address}`);
            
            const ethBalance = await getNativeBalance(account.address, proxy, rpc);
        
            if (parseFloat(ethBalance) < newBridgeAmount) {
                newBridgeAmount = parseFloat(ethBalance) - 1 / 2650; // ~1$ для резервных комиссий
                newBridgeAmount *= (1 - randomDecreaseFactor);
                logger.debug(`[${pkShort}] Adjusted bridge amount due to low balance: ${newBridgeAmount.toFixed(4)}`);
        
                if (newBridgeAmount < 0) {
                    logger.error(
                        `[${pkShort}] Not enough balance for bridge from chain ${chainFromRaw}, ` +
                        `balance ~${Number(ethBalance).toFixed(3)}`
                    );
                    continue;
                }
            }
        
            await bridgeToAbstract(privateKey, newBridgeAmount, chainFromRaw, proxy);
        
            const minDelaySec = configJson.bridge.minDelayBetweenWalletsMin * 60;
            const maxDelaySec = configJson.bridge.maxDelayBetweenWalletsMin * 60;
            logger.debug(`[${pkShort}] Min delay: ${minDelaySec}s, Max delay: ${maxDelaySec}s`);
            await randomDelay(minDelaySec, maxDelaySec);
        
        } catch (err) {
            logger.error(`[${pkShort}] manageBridge error on row ${rowIndex}: ${err.message}`);
        }
    }
}

async function manageNewAccountsInSoft(worksheet, rowNumbers) {
    for (const rowIndex of rowNumbers) {
        const row = worksheet.getRow(rowIndex);

        const privateKey = String(row.getCell(1).value || '').trim();
        const pkShort = privateKey.slice(0, 15);

        const isActive = row.getCell(2).value;
        if (!isActive || !privateKey) {
            logger.debug(`[${pkShort}] Row ${rowIndex} skipped (inactive or no privateKey)`);
            continue;
        }

        const walletAlreadyExists = checkIsWalletExists(privateKey);
        if (walletAlreadyExists) {
            continue;
        }

        const proxy = String(row.getCell(3).value || '').trim();
        const userAgent = String(row.getCell(4).value || '').trim();
        const shouldConnectX = row.getCell(8).value;
        const xSession = String(row.getCell(9).value || '').trim();
        const shouldConnectDiscord = row.getCell(10).value;
        const discordSession = String(row.getCell(11).value || '').trim();

        logger.info(`[${pkShort}] Starting initAccount on row ${rowIndex}`);

        let proxyOptions = null;
        if (proxy) {
            const [host, port, username, password] = proxy.replace(' ', '').split(':');
            proxyOptions = { host, port, username, password };
        }

        let browser;
        try {
            const { page, browser: br } = await loadBrowser(proxyOptions, userAgent, privateKey);
            browser = br;
            await waitDelay(3);

            await initMetamask(browser, privateKey);
            await waitDelay(0);

            await login(
                page,
                browser,
                privateKey,
                shouldConnectX,
                xSession,
                shouldConnectDiscord,
                discordSession
            );
            await waitDelay(1);

            logger.success(`[${pkShort}] initAccount finished row ${rowIndex}`);
            await browser.close();
            logger.debug(`[${pkShort}] Browser closed for row ${rowIndex}`);
            await waitDelay(1);

        } catch (err) {
            logger.error(`[${pkShort}] Error on row ${rowIndex}: ${err.message}`);
            if (browser) {
                await browser.close();
                logger.debug(`[${pkShort}] Browser closed after error on row ${rowIndex}`);
            }
        }

        const minDelaySec = configJson.general.minDelayBetweenRunNewAccMin * 60;
        const maxDelaySec = configJson.general.maxDelayBetweenRunNewAccMin * 60;
        await randomDelay(minDelaySec, maxDelaySec);
    }
}

async function manageActivities(worksheet, rowNumbers) {
    try {
        const moduleMap = {
            absStream: watchStream,
            absTrade: tradeOnSite,
            absUpvote: upvote,
            absClaimBadge: claimAllBadges
        };

        const absActiveModules = Object.entries(configJson.modules)
            .filter(([key, isActive]) => isActive && moduleMap[key])
            .map(([key]) => moduleMap[key]);

        const useMoonshot = configJson.modules.moonshot;

        if (absActiveModules.length === 0 && !useMoonshot) {
            logger.info('No active modules for manageActivities');
            return;
        }

        for (const rowIndex of rowNumbers) {
            const row = worksheet.getRow(rowIndex);
            const isActive = row.getCell(2).value;
            if (!isActive) {
                continue;
            }
            const privateKey = String(row.getCell(1).value || '').trim();
            const pkShort = privateKey.slice(0, 15);

            const walletAlreadyExists = checkIsWalletExists(privateKey);
            if (!walletAlreadyExists) {
                logger.debug(`[${pkShort}] Wallet not in state, skipping manageActivities`);
                continue;
            }

            const proxy = String(row.getCell(3).value || '').trim();
            const userAgent = String(row.getCell(4).value || '').trim();
            const shouldConnectX = row.getCell(8).value;
            const xSession = String(row.getCell(9).value || '').trim();
            const shouldConnectDiscord = row.getCell(10).value;
            const discordSession = String(row.getCell(11).value || '').trim();

            logger.info(`[${pkShort}] manageActivities started on row ${rowIndex}`);

            let proxyOptions = null;
            if (proxy) {
                const [host, port, username, password] = proxy.replace(' ', '').split(':');
                proxyOptions = { host, port, username, password };
            }

            let browser;
            try {
                const { page, browser: br } = await loadBrowser(proxyOptions, userAgent, privateKey);
                browser = br;
                await waitDelay(3);

                await initMetamask(browser, privateKey);
                await waitDelay(0);

                if (absActiveModules.length > 0) {
                    await login(
                        page,
                        browser,
                        privateKey,
                        shouldConnectX,
                        xSession,
                        shouldConnectDiscord,
                        discordSession
                    );
                    await waitDelay(1);

                    const modulesInRandomOrder = shuffleArray(absActiveModules);
                    for (const mod of modulesInRandomOrder) {
                        if (mod === tradeOnSite) {
                            await mod(page, privateKey, proxy);
                        } else {
                            await mod(page, privateKey);
                        }
                        await waitDelay(2);
                    }
                }
                
                if (useMoonshot) {
                    await initWalletInMoonshot(page, browser, privateKey);
                    await waitDelay(2);
                    await tradeMoonshot(page, browser, privateKey, proxy, userAgent);
                    await waitDelay(2);
                }
                
                logger.success(`[${pkShort}] manageActivities finished row ${rowIndex}`);
                await browser.close();
                logger.debug(`[${pkShort}] Browser closed for row ${rowIndex}`);
            } catch (err) {
                logger.error(`[${pkShort}] manageActivities error on row ${rowIndex}: ${err.message}`);
                if (browser) {
                    await browser.close();
                    logger.debug(`[${pkShort}] Browser closed after error on row ${rowIndex}`);
                }
            }
            const minDelaySec = configJson.general.minDelayBetweenRunNewAccMin * 60;
            const maxDelaySec = configJson.general.maxDelayBetweenRunNewAccMin * 60;
            await randomDelay(minDelaySec, maxDelaySec);
        }
    } catch (err) {
        logger.error(`manageActivities() error: ${err.message}`);
    }
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export { start };
