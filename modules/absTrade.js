import { waitForAndSmartClick } from '../utils/browser.js';
import Big from 'big.js';
import { logger } from '../utils/logger.js';
import { waitDelay } from '../utils/delay.js';
import { tokensJson, stateJson, configJson } from '../utils/constants.js';
import { updateBalanceState } from '../utils/balance.js';
import { randBetween, randomDelay } from '../utils/random.js';

async function startTrade(page, contractIn, contractOut, amountIn, privateKey) {
    const pkShort = privateKey.slice(0, 15);
    logger.info(`amount in: ${amountIn}`);
    await page.goto('https://www.abs.xyz/profile');
    await waitDelay(3);
    await waitForAndSmartClick(page, '#sidebar-Trade a.styles_linkButton__GAIYi', 'Click Trade button');
    await waitDelay(2);
    
    const tradeLink = `https://www.abs.xyz/trade/token/${contractOut}?targetAddress=${contractOut}&sourceAddress=${contractIn}`;
    await page.goto(tradeLink);
    await waitDelay(2);
    
    const sellInputSelector = 'input.styles_tokenValueInput__7s241.h3.font-medium[placeholder="0.00"]';
    await waitForAndSmartClick(page, sellInputSelector, 'Focus on sell input');
    
    await page.focus(sellInputSelector);
    
    const amountInBig = new Big(amountIn);
    await page.keyboard.type(amountInBig.toFixed(8), { delay: 200 });
    logger.debug(`[${pkShort}] Typed ${amountInBig.toFixed(6)} in sell field`);
    
    await waitDelay(2);
    
    await waitForAndSmartClick(
        page,
        "xpath///div[@class='styles_actions__T5NMG']//button[.//span[normalize-space()='Review']]",
        'Click Review button'
    );
    await waitDelay(1);
    
    await waitForAndSmartClick(
        page,
        "xpath///div[@class='styles_actions__T5NMG']//button[.//span[normalize-space()='Trade']]",
        'Click Trade button2'
    );
    logger.success(`[${pkShort}] tradeOnSite (contractIn: ${contractIn}, contractOut: ${contractOut}, amountIn: ${amountIn})`);
    return;
}

async function tradeOnSite(page, privateKey, proxyStr) {
    const pkShort = privateKey.slice(0, 15);

    await updateBalanceState(privateKey, proxyStr);

    const nTransactions = Math.round(randBetween(configJson.tradingConfigs.absTrade.nTransactionsMin, configJson.tradingConfigs.absTrade.nTransactionsMax));
    logger.info(`[${pkShort}] tradeOnSite will perform ${nTransactions} transactions`);
    for (let i = 0; i < nTransactions; i++) {
        const { needSwapBackToETH, tokenAmount, contract } = isNeedSwapBackToETH(privateKey);
        if (needSwapBackToETH) {
            const reducedTokenAmount = tokenAmount * 0.9995;
            await startTrade(page, contract, '0x0000000000000000000000000000000000000000', reducedTokenAmount, privateKey);
        } else {
            if (i === nTransactions - 1) {
                logger.debug(`[${pkShort}] Skipping last buy trade`);
                break;
            }
            const ethAmount = randBetween(configJson.tradingConfigs.absTrade.minETH, configJson.tradingConfigs.absTrade.maxETH);
            await startTrade(page, '0x0000000000000000000000000000000000000000', getRandomNonContract(), ethAmount, privateKey);
        }
        await randomDelay(configJson.tradingConfigs.absTrade.minDelayBetweenBuyAndSellSec, configJson.tradingConfigs.absTrade.maxDelayBetweenBuyAndSellSec);
        await updateBalanceState(privateKey, proxyStr);
    }
    
    logger.success(`[${pkShort}] tradeOnSite finished`);
    return;
}

function isNeedSwapBackToETH(privateKey) {
    const userState = stateJson[privateKey];
    for (let i = 0; i < tokensJson.length; i++) {
        const data = tokensJson[i];
        const userBalance = parseFloat(userState[data.name]);
        const userBalanceInUSD = userBalance * data.histPrice;

        if (userBalanceInUSD > 0.01 && data.name && data.name !== 'Ether') {
            return {
                needSwapBackToETH: true,
                tokenAmount: userBalance, 
                contract: data.contract
            };
        }
    }
    return {
        needSwapBackToETH: false,
        tokenAmount: null, 
        contract: null
    };
}



function getRandomNonContract() {
    const filteredTokens = tokensJson.filter(token => token.name !== "Ether");
    const randomIndex = Math.floor(Math.random() * filteredTokens.length);
    return filteredTokens[randomIndex].contract;
}


export { tradeOnSite };
