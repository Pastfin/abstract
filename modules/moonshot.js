import { stateJson, configJson } from '../utils/constants.js';
import { waitForAndSmartClick } from '../utils/browser.js';
import { getTokenBalance } from '../utils/balance.js';
import { logger } from '../utils/logger.js';
import { waitDelay } from '../utils/delay.js';
import { randBetween, randomDelay } from '../utils/random.js';

async function getRealUserAgent(page) {
    const client = await page.target().createCDPSession();
    const userAgentData = await client.send('Browser.getVersion');
    const originalUserAgent = userAgentData.userAgent;
    const productVersion = userAgentData.product;
    const [productName, rawVersion] = productVersion.split('/');

    if (productName === 'Chrome') {
        const versionParts = rawVersion.split('.');
        for (let i = 1; i < versionParts.length; i++) {
            versionParts[i] = "0";
        }
        const newVersion = versionParts.join('.');
        const newUserAgent = originalUserAgent.replace(/Chrome\/[\d.]+/i, `Chrome/${newVersion}`);
        return newUserAgent;
    } else {
        logger.error('Only compatible with chrome');
    }
}


async function initWalletInMoonshot(page, browser, privateKey) {
    const pkShort = privateKey.slice(0, 15);
    logger.info(`[${pkShort}] Moonshot initWalletInMoonshot started`);
    const originalUserAgent = await getRealUserAgent(page);
    await page.setUserAgent(originalUserAgent); // to bypass cloudflare

    await page.goto('https://dexscreener.com/moonshot/abstract');
    await waitDelay(1);
    await page.reload();
    await waitDelay(4);
    
    for (let attempt = 1; attempt <= 3; attempt++) {
        logger.debug(`[${pkShort}] Attempt #${attempt} to Click Connect`);
        try {
            logger.debug(`[${pkShort}] Attempt #${attempt} to Click Connect`);
            await waitForAndSmartClick(page, '.chakra-button.custom-10h434f', 'Click Connect');
            await waitDelay(1);
            await waitForAndSmartClick(page, 'button img[alt="Abstract Global Wallet"]', 'Click Abstract Global Wallet');
            await waitDelay(3);
            logger.info(`[${pkShort}] Moonshot AGW connecting started`);
            break;
        } catch (err) {
            logger.warn(`[${pkShort}] Attempt #${attempt} to Click Connect failed: ${err.message}`);
            if (attempt === 3) {
                logger.error(`[${pkShort}] All 3 attempts to Click Connect failed `);
                return;
            }
            await page.reload();
            await waitDelay(4);
        }
    }


    const allPages = await browser.pages();
    logger.debug(`[${pkShort}] All opened pages:`);
    for (const p of allPages) {
        logger.debug(`[${pkShort}] Page URL: ${p.url()}`);
    }

    const privyWindow = allPages.find(p => p.url().startsWith('https://privy.abs.xyz/'));
    await privyWindow.bringToFront();
    await waitDelay(2);

    const buttons1 = await privyWindow.$$('.login-method-button');
    for (const button of buttons1) {
        const text = await privyWindow.evaluate(el => el.innerText, button);
        if (text.includes('Continue with a wallet')) {
            logger.debug(`[${pkShort}] Click 'Continue with a wallet'`);
            await button.click();
            break;
        }
    }

    await waitDelay(1);

    const buttons2 = await privyWindow.$$('button');
    for (const button of buttons2) {
        const text = await privyWindow.evaluate(el => el.innerText, button);
        if (text.includes('MetaMask')) {
            logger.debug(`[${pkShort}] Click MetaMask`);
            await button.click();
            break;
        }
    }

    await waitDelay(3);
    
    let metaMaskPageConnect;
    let currentPages;
    
    currentPages = await browser.pages();

    for (const currentPage of currentPages) {
        const url = await currentPage.url();
        logger.debug(`[${pkShort}] Page URL: ${url}`);
        if (url.includes('chrome-extension')) {
            metaMaskPageConnect = currentPage;
        }
    }

    await metaMaskPageConnect.bringToFront();
    await waitForAndSmartClick(metaMaskPageConnect, '[data-testid="page-container-footer-next"]', 'Continue Next button');
    await waitDelay(3);
    await waitForAndSmartClick(metaMaskPageConnect, '[data-testid="page-container-footer-next"]', 'Continue Confirm button');
    await waitDelay(3);

    currentPages = await browser.pages();
    
    for (const currentPage of currentPages) {
        const url = await currentPage.url();
        logger.debug(`[${pkShort}] Page URL: ${url}`);
        if (url.includes('chrome-extension')) {
            metaMaskPageConnect = currentPage;
        }
    }

    try {
        await waitForAndSmartClick(metaMaskPageConnect, '[data-testid="confirm-footer-button"]', 'Connect Confirm button');
    } catch {
        await waitForAndSmartClick(metaMaskPageConnect, '[data-testid="page-container-footer-next"]', 'Continue Confirm button');
        await waitDelay(3);
        await waitForAndSmartClick(metaMaskPageConnect, '[data-testid="confirm-footer-button"]', 'Connect Confirm button');
    }
    await waitDelay(2);
    await privyWindow.bringToFront();
    await waitForAndSmartClick(privyWindow, 'xpath///button[contains(., "Approve")]', 'Connect Confirm button');
    logger.success(`[${pkShort}] initWalletInMoonshot finished`);
    return;
}

async function tradeMoonshot(page, browser, privateKey, proxyStr, fakeUserAgent) {
    const pkShort = privateKey.slice(0, 15);
    logger.info(`[${pkShort}] tradeMoonshot started`);
    logger.debug(`[${pkShort}] Navigating to https://dexscreener.com/moonshot/abstract`);

    const originalUserAgent = await getRealUserAgent(page); // to bypass cloudflare
    await page.setUserAgent(originalUserAgent);
    await page.goto('https://dexscreener.com/moonshot/abstract');


    logger.debug(`[${pkShort}] Page loaded. Waiting 4s...`);
    await waitDelay(3);

    const userState = stateJson[privateKey];
    const publicKey = userState['absWalletAddress'];
    logger.debug(`[${pkShort}] Using publicKey = ${publicKey}`);

    let nTransactions = Math.round(randBetween(configJson.tradingConfigs.moonshot.nTransactionsMin, configJson.tradingConfigs.moonshot.nTransactionsMax));
    logger.debug(`[${pkShort}] Number of transactions to execute: ${nTransactions}`);

    logger.debug(`[${pkShort}] Fetching trading pairs...`);
    const tradingPairs = await getPairLinks(page);
    logger.debug(`[${pkShort}] Found tradingPairs: ${JSON.stringify(tradingPairs)}`);

    let currentType = 'Buy';
    let tradingPairURL;

    for (let i = 0; i < nTransactions; i++) {
        logger.debug(`[${pkShort}] Starting transaction #${i + 1}, type: '${currentType}'`);
        logger.info(`[${pkShort}] Transaction #${i + 1} | Type: ${currentType}`);
        let amount;

        if (i + 1 === nTransactions && currentType === 'Buy') {
            logger.success(`[${pkShort}] Skipping last #${i + 1} transaction due to "Buy" mode`);
            continue;
        }

        if (currentType === 'Buy') {
            await page.setUserAgent(originalUserAgent); // to bypass cloudflare
            
            tradingPairURL = 'https://dexscreener.com' + tradingPairs[Math.floor(Math.random() * tradingPairs.length)];
            logger.debug(`[${pkShort}] Selected tradingPairURL: ${tradingPairURL}`);
            const currentUrl = await page.url();
            if (tradingPairURL.toLowerCase() !== currentUrl.toLowerCase()) {
                logger.debug(`[${pkShort}] Navigating to selected trading pair URL...`);
                await page.goto(tradingPairURL);
                logger.debug(`[${pkShort}] Page loaded. Waiting 3s...`);
                await waitDelay(3);
            }
            const randAmount = randBetween(configJson.tradingConfigs.moonshot.minETH, configJson.tradingConfigs.moonshot.maxETH);
            amount = formatAmountStr(randAmount.toString());
            logger.debug(`[${pkShort}] Buy amount set to ${amount}`);
        } else {
            const tokenContract = tradingPairURL.split("abstract/")[1];
            logger.debug(`[${pkShort}] Token contract extracted: ${tokenContract}`);
            const rawBalance = await getTokenBalance(tokenContract, publicKey, proxyStr);
            logger.debug(`[${pkShort}] Raw token balance: ${rawBalance}`);
            amount = formatAmountStr(rawBalance);
            logger.debug(`[${pkShort}] Sell amount (formatted) = ${amount}`);
        }

        logger.info(`[${pkShort}] Amount for this ${currentType}: ${amount}`);

        await page.setUserAgent(fakeUserAgent); // switching to fake user agent from Excel when swapping in AGW

        if (currentType === 'Buy') {
            logger.debug(`[${pkShort}] Clicking "Buy" tab...`);
            await waitForAndSmartClick(
                page,
                'xpath///button[@id="tabs-:R2qkeku6kmqmau:--tab-0"]',
                'Click Buy button'
            );
            await waitDelay(1);
            logger.debug(`[${pkShort}] "Buy" tab clicked, waited 1s`);
        } else {
            logger.debug(`[${pkShort}] Clicking "Sell" tab...`);
            await waitForAndSmartClick(
                page,
                'xpath///button[@id="tabs-:R2qkeku6kmqmau:--tab-1"]',
                'Click Sell button'
            );
            await waitDelay(1);
            logger.debug(`[${pkShort}] "Sell" tab clicked, waited 1s`);
        }

        const inputXPath = '//div[@id="moonshot-trade-widget"]/div/div[2]/div/div/div[1]/div[1]/input';
        const inputXPathFull = 'xpath/' + inputXPath;
        const buyOrSellButton = 'xpath///div[@id="moonshot-trade-widget"]/div/div[2]/div/div/div[3]/div[1]/div/button[1]';

        logger.debug(`[${pkShort}] Clearing input field...`);
        await page.evaluate((xpath) => {
            const input = document.evaluate(
                xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
            ).singleNodeValue;
            if (input) {
                Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
                    .set.call(input, '');
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, inputXPath);

        logger.debug(`[${pkShort}] Clicking on input field...`);
        await waitForAndSmartClick(page, inputXPathFull, 'Click input field');
        logger.debug(`[${pkShort}] Typing amount: ${amount}`);
        await page.focus(inputXPathFull);
        await page.keyboard.type(amount, { delay: 0 });
        await waitDelay(1);
        logger.debug(`[${pkShort}] Clicking "Buy/Sell" button...`);
        await waitForAndSmartClick(page, buyOrSellButton, 'Click buy/sell');
        logger.debug(`[${pkShort}] "Buy/Sell" clicked. Waiting 3s...`);
        await waitDelay(4);

        logger.debug(`[${pkShort}] Checking for Privy window...`);
        const allPages = await browser.pages();
        const privyWindow = allPages.find(p => p.url().startsWith('https://privy.abs.xyz/'));
        if (!privyWindow) {
            logger.warn(`[${pkShort}] Privy window not found! Skipping this transaction step.`);
            continue;
        }
        await privyWindow.bringToFront();
        logger.debug(`[${pkShort}] Brought Privy window to front.`);

        if (currentType === 'Sell') {
            logger.debug(`[${pkShort}] Clicking "Continue" on Privy window...`);
            await waitForAndSmartClick(
                privyWindow,
                'xpath///button[contains(., "Continue")]',
                'Connect Confirm button'
            );
            logger.debug(`[${pkShort}] "Continue" clicked. Waiting 2s...`);
            await waitDelay(2);
        }

        logger.debug(`[${pkShort}] Clicking "Approve" button on Privy window...`);
        await waitForAndSmartClick(
            privyWindow,
            'xpath///button[contains(., "Approve")]',
            'Connect Confirm button'
        );
        logger.debug(`[${pkShort}] "Approve" clicked. Waiting...`);
        await waitDelay(4);

        try {
            logger.debug(`[${pkShort}] Clicking "All Done" button on Privy window...`);
            await waitForAndSmartClick(
                privyWindow,
                'xpath///button[contains(., "All Done")]',
                'Connect Confirm button'
            );
        } catch {
            logger.debug(`[${pkShort}] Catching error with first approve not clicked`);
            logger.debug(`[${pkShort}] Clicking "Approve" button on Privy window...`);
            await waitForAndSmartClick(
                privyWindow,
                'xpath///button[contains(., "Approve")]',
                'Connect Confirm button'
            );
            await waitDelay(2);
            logger.debug(`[${pkShort}] Clicking "All Done" button on Privy window...`);
            await waitForAndSmartClick(
                privyWindow,
                'xpath///button[contains(., "All Done")]',
                'Connect Confirm button'
            );
        }

        logger.debug(`[${pkShort}] "All Done" clicked. Waiting...`);

        currentType = currentType === 'Buy' ? 'Sell' : 'Buy';
        logger.debug(`[${pkShort}] Transaction #${i + 1} done. Next type: ${currentType}`);
        logger.success(`[${pkShort}] Transaction #${i + 1} complete`);
        await randomDelay(configJson.tradingConfigs.moonshot.minDelayBetweenBuyAndSellSec, configJson.tradingConfigs.moonshot.maxDelayBetweenBuyAndSellSec);
    }

    logger.success(`[${pkShort}] tradeMoonshot finished`);
    return;
}

async function getPairLinks(page) {
    const links = await page.$$eval('.custom-1l5wjfu', elements =>
        elements.map(el => el.getAttribute('href')).slice(0, 2)
    );
    return links;
}

function formatAmountStr(amountStr) {
    if (!amountStr.includes(".")) return amountStr;
    let [integerPart, fractionalPart] = amountStr.split(".");
    if (fractionalPart.length > 12) {
        fractionalPart = fractionalPart.slice(0, 10);
    }
    return fractionalPart.length > 0 ? `${integerPart}.${fractionalPart}` : integerPart;
}

export { initWalletInMoonshot, tradeMoonshot };
