import { waitForAndSmartClick } from '../utils/browser.js';
import { logger } from '../utils/logger.js';
import { waitDelay } from '../utils/delay.js';

async function upvote(page, privateKey) {
    const pkShort = privateKey.slice(0, 15);
    logger.info(`[${pkShort}] upvote started`);

    await page.goto('https://www.abs.xyz/discover');
    await waitDelay(2);

    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button.styles_tag__r4Ygt.styles_upvote__a_jB6.styles_shadows__fhwBe.b1'));
        const unclickedButton = buttons.find(button => !button.classList.contains('styles_active__OSG_t'));
        if (unclickedButton) {
            unclickedButton.click();
        }
    });
    
    logger.success(`[${pkShort}] upvote finished`);
    await waitDelay(2);
    return;
}

export { upvote };
