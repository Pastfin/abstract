import { waitForAndSmartClick } from '../utils/browser.js';
import { logger } from '../utils/logger.js';
import { waitDelay } from '../utils/delay.js';

async function claimAllBadges(page, privateKey) {
    const pkShort = privateKey.slice(0, 15);
    logger.info(`[${pkShort}] claimAllBadges started`);
    await page.goto('https://www.abs.xyz/rewards');
    await waitDelay(2);

    while (true) {
        try {
            const found = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'))
                    .filter(button => button.textContent.includes('Claim'));
                return buttons;
            });
            
            if (!found) {
                logger.debug(`[${pkShort}] No "Claim" button found, exiting loop`);
                break;
            }
            
            await waitForAndSmartClick(
                page,
                'xpath///button[contains(., "Claim")]'
            );
            await waitDelay(1);
            logger.debug(`[${pkShort}] Attempting to confirm badge claim`);
            await waitForAndSmartClick(
                page,
                'button.styles_buttonClaim___tjQp'
            );
            await waitDelay(1);
        } catch (err) {
            logger.debug(`[${pkShort}] No more badges or error, ending loop`);
            break;
        }
    }

    logger.success(`[${pkShort}] claimAllBadges finished`);
    return;
}

export { claimAllBadges };
