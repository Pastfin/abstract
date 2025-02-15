import { waitForAndClick, typeInput } from './browser.js';
import { logger } from './logger.js';
import { waitDelay } from './delay.js';

async function initMetamask(browser, privateKey) {
    const pkShort = privateKey.slice(0, 15);

    logger.info(`[${pkShort}] Initializing MetaMask setup`);

    const pages = await browser.pages();
    let metamaskPage;

    for (const page of pages) {
        const url = await page.url();
        logger.debug(`[${pkShort}] Checking page URL: ${url}`);
        if (url.includes('chrome-extension')) {
            metamaskPage = page;
            break;
        }
    }

    logger.info(metamaskPage.url());

    if (!metamaskPage) {
        logger.error(`[${pkShort}] MetaMask page not found`);
        return;
    }
    logger.debug(metamaskPage);
    logger.debug(`[${pkShort}] Found MetaMask page`);
    await waitForAndClick(metamaskPage, '#onboarding__terms-checkbox', 'Terms checkbox');
    await waitForAndClick(metamaskPage, 'button[data-testid="onboarding-create-wallet"]:not([disabled])', 'Create Wallet button');
    await waitForAndClick(metamaskPage, 'button[data-testid="metametrics-no-thanks"]', 'No Thanks button');

    const password = 'pwdpwdpwd123$$$';
    await typeInput(metamaskPage, 'input[data-testid="create-password-new"]', password, 'Create Password');
    await typeInput(metamaskPage, 'input[data-testid="create-password-confirm"]', password, 'Confirm Password');
    await waitForAndClick(metamaskPage, 'input[data-testid="create-password-terms"]', 'Password Terms checkbox');
    await waitForAndClick(metamaskPage, 'button[data-testid="create-password-wallet"]:not([disabled])', 'Create Password Wallet button');
    await waitForAndClick(metamaskPage, 'button[data-testid="secure-wallet-later"]', 'Secure Wallet Later button');
    await waitForAndClick(metamaskPage, 'input[data-testid="skip-srp-backup-popover-checkbox"]', 'Skip SRP Backup checkbox');
    await waitForAndClick(metamaskPage, 'button[data-testid="skip-srp-backup"]:not([disabled])', 'Skip SRP Backup button');
    await waitForAndClick(metamaskPage, 'button[data-testid="onboarding-complete-done"]', 'Onboarding Complete button');
    await waitForAndClick(metamaskPage, 'button[data-testid="pin-extension-next"]', 'Pin Extension Next button');
    await waitForAndClick(metamaskPage, 'button[data-testid="pin-extension-done"]', 'Pin Extension Done button');

    logger.debug(`[${pkShort}] Waiting after onboarding steps`);
    await waitDelay(3);

    await waitForAndClick(metamaskPage, 'button[data-testid="account-menu-icon"]', 'Account Menu Icon');
    await waitDelay(3);
    await waitForAndClick(metamaskPage, 'button[data-testid="multichain-account-menu-popover-action-button"]', 'Multichain Account Menu button');

    await waitDelay(1);
    logger.debug(`[${pkShort}] Clicking "Import account"`);
    await metamaskPage.evaluate(() => {
        const button = [...document.querySelectorAll('button')].find(el =>
            el.textContent.includes('Import account') || el.textContent.includes('Импортировать счет')
        );
        if (button) {
            button.click();
        }
    });

    const privateKeyLast10 = privateKey.slice(-10);
    logger.debug(`[${pkShort}] Typing private key (last 10: ${privateKeyLast10})`);
    await typeInput(metamaskPage, 'input#private-key-box', privateKey, 'Private Key Input');
    await waitDelay(1);

    await waitForAndClick(metamaskPage, 'button[data-testid="import-account-confirm-button"]:not([disabled])', 'Import Account Confirm button');
    await waitDelay(1);

    await metamaskPage.close();
    logger.success(`[${pkShort}] MetaMask setup complete (imported account)`);
    return;
}

export { initMetamask };
