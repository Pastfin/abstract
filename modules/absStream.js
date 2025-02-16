import { waitForAndSmartClick } from '../utils/browser.js';
import Big from 'big.js';
import { logger } from '../utils/logger.js';
import { waitDelay } from '../utils/delay.js';
import { randBetween } from '../utils/random.js';
import { configJson } from '../utils/constants.js';

async function watchStream(page, privateKey) {
    const pkShort = privateKey.slice(0, 15);

    const durationMin = randBetween(configJson.absStream.minWatchTimeMin, configJson.absStream.maxWatchTimeMin);
    const ethTipAmount = randBetween(configJson.absStream.ethTipSizeMin, configJson.absStream.ethTipSizeMax).toFixed(12);

    logger.info(`[${pkShort}] watchStream started. Duration: ${durationMin.toFixed(1)} min, Tip: ${ethTipAmount}`);

    await page.goto('https://www.abs.xyz/profile');
    await waitDelay(3);
    await waitForAndSmartClick(page, '#sidebar-Stream a.styles_linkButton__GAIYi');
    await waitDelay(1);
    await page.waitForSelector('ul.styles_spotlightGrid__cQEVn', { visible: true });

    const streamItems = await page.$$('ul.styles_spotlightGrid__cQEVn > li.styles_spotlightGridItem__M76jO');
    const firstTwo = streamItems.slice(0, 2);
    const randomIndex = Math.floor(Math.random() * firstTwo.length);
    await firstTwo[randomIndex].click();;
    await waitDelay(4);

    await page.evaluate(() => {
        document
            .querySelector('body > div.styles_outerPadding__D5ZVu > div > div > main > section > div > div > article.styles_pane__FCR0G.styles_livestream__2Tdj6 > figure > mux-player')?.shadowRoot
            ?.querySelector('media-theme')?.shadowRoot
            ?.querySelector('media-controller > div > media-play-button')
            ?.click();
    });
    logger.debug(`[${pkShort}] Stream play button triggered`);
    await waitDelay(1);

    await new Promise(resolve => setTimeout(resolve, durationMin * 60 * 1000));
    
    if (ethTipAmount > 0 && configJson.modules.absStreamTip) {
        await waitForAndSmartClick(page, 'button.styles_tipButton__Xvv8a');
        await waitDelay(0);
        const ethTipAmountBig = new Big(ethTipAmount);
        const tipInputSelector = 'input.styles_input__i5gVP.styles_tipInput__Ug7F_';
        await waitForAndSmartClick(page, tipInputSelector);
        await page.focus(tipInputSelector);
        await page.keyboard.type(ethTipAmountBig.toFixed(), { delay: 200 });
        logger.debug(`[${pkShort}] Typed ETH tip amount: ${ethTipAmountBig.toFixed()}`);
        await waitDelay(0);
        await waitForAndSmartClick(page, 'button.b3.styles_container__P6k6P.styles_height-40__gnlvW.styles_primary__223tq');
    }

    await waitDelay(4);

    logger.debug(`[${pkShort}] Waiting for stream duration: ${durationMin} minute(s)`);

    logger.success(`[${pkShort}] watchStream finished`);
    return;
}

export { watchStream };
