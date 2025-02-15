import { waitForAndSmartClick } from './browser.js';
import { execSync } from 'child_process';
import { checkIsWalletExists, updateState } from './dataHandler.js';
import { waitDelay } from './delay.js';
import { logger } from './logger.js';
import { stateJson } from './constants.js';

async function login(
    page,
    browser,
    privateKey,
    shouldConnectX,
    xSession,
    shouldConnectDiscord,
    discordSession
) {
    const pkShort = privateKey.slice(0, 15);

    logger.info(`[${pkShort}] Login process on Abstract site (start)`);
    try {
        await page.goto("https://www.abs.xyz/login");
        await waitDelay(2);

        await page.waitForSelector('button.styles_loginButton___pSyl');
        const buttons = await page.$$('button.styles_loginButton___pSyl');
        for (const button of buttons) {
            const text = await button.evaluate(node => node.innerText.trim());
            if (text === "Login with Wallet") {
                logger.debug(`[${pkShort}] Found and clicked "Login with Wallet"`);
                await button.click();
                break;
            }
        }

        await waitDelay(1);
        await page.bringToFront();
        await waitDelay(0);

        await page.waitForSelector('button.login-method-button');
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll("button"));
            const metaMaskButton = buttons.find(btn => btn.innerText.includes("MetaMask"));
            if (metaMaskButton) {
                metaMaskButton.focus();
                setTimeout(() => {
                    metaMaskButton.click();
                }, 1000);
            }
        });
        logger.debug(`[${pkShort}] Triggered MetaMask connect attempt`);
        await waitDelay(3);

        let currentPages;
        let metaMaskPageConnect;
        currentPages = await browser.pages();
        for (const currentPage of currentPages) {
            const url = await currentPage.url();
            logger.debug(`[${pkShort}] Current page URL: ${url}`);
            if (url.includes('connect')) {
                metaMaskPageConnect = currentPage;
                break;
            }
        }

        if (!metaMaskPageConnect) {
            logger.error(`[${pkShort}] Connection confirmation page not found`);
            throw new Error("No connect page found");
        }

        await metaMaskPageConnect.bringToFront();
        logger.debug(`[${pkShort}] Brought MetaMask connect page to front`);
        await waitForAndSmartClick(metaMaskPageConnect, '[data-testid="page-container-footer-next"]', 'Connect Next button');
        await waitDelay(1);
        await waitForAndSmartClick(metaMaskPageConnect, '[data-testid="page-container-footer-next"]', 'Connect Next button 2');
        await waitDelay(4);
        currentPages = await browser.pages();
        for (const currentPage of currentPages) {
            const url = await currentPage.url();
            logger.debug(`[${pkShort}] Current page URL: ${url}`);
            if (url.includes('chrome-extension')) {
                metaMaskPageConnect = currentPage;
                break;
            }
        }
        try {
            await waitForAndSmartClick(metaMaskPageConnect, '[data-testid="confirm-footer-button"]', 'Connect Confirm button');
        } catch { }

        logger.success(`[${pkShort}] Login process completed (MetaMask connected)`);

        await waitDelay(4);
        try{
            await page.click('button.styles_button__X2cze.b3.styles_container__P6k6P.styles_height-40__gnlvW.styles_secondary__O5bBD');
            await waitDelay(1);
        } catch { }

        const needToInitData = !checkIsWalletExists(privateKey);
        if (needToInitData) {
            await exportAbsKey(page, privateKey);
        }

        const userState = stateJson[privateKey] || {};

        const isXConnected = userState.X === true;
        const isDiscordConnected = userState.Discord === true;

        // await new Promise(resolve => setTimeout(resolve, 500000));

        const needX = shouldConnectX && !isXConnected && xSession;
        const needDiscord = shouldConnectDiscord && !isDiscordConnected && discordSession;

        if (needX || needDiscord) {
            await addSocials(page, privateKey, needX, xSession, needDiscord, discordSession);
        } else {
            logger.debug(`[${pkShort}] No additional socials to connect (X or Discord)`);
        }

    } catch (err) {
        logger.error(`[${pkShort}] Login failed: ${err.message}`);
        throw err;
    }
}

async function exportAbsKey(page, privateKey) {
    const pkShort = privateKey.slice(0, 15);

    try {
        await page.waitForSelector('div.styles_skipButton__DMjHD button', { visible: true, timeout: 4000 });
        await page.click('div.styles_skipButton__DMjHD button');
        logger.debug(`[${pkShort}] "Skip" button clicked`);
    } catch {
        logger.debug(`[${pkShort}] "Skip" button not found or not needed`);
    }

    try {
        const securityClicked = await page.evaluate(() => {
            const securityLi = Array.from(document.querySelectorAll("li")).find(li =>
                li.id.includes("sidebar-Security") && li.innerText.includes("Security")
            );
            if (securityLi) {
                const button = securityLi.querySelector("div.styles_linkButton__GAIYi");
                if (button) {
                    button.click();
                    return true;
                }
            }
            return false;
        });

        if (securityClicked) {
            logger.debug(`[${pkShort}] "Security" button clicked`);
        } else {
            logger.debug(`[${pkShort}] "Security" button not found`);
        }

        await waitDelay(1);

        const exportClicked = await page.evaluate(() => {
            const exportArticle = [...document.querySelectorAll("article")].find(article =>
                article.querySelector("h3")?.innerText.includes("Export Signer Private Key")
            );
            if (exportArticle) {
                const button = exportArticle.querySelector("button");
                if (button) {
                    button.click();
                    return true;
                }
            }
            return false;
        });
        if (exportClicked) {
            logger.debug(`[${pkShort}] "Export" button clicked`);
        } else {
            logger.debug(`[${pkShort}] "Export" button not found`);
        }

        await waitDelay(1);

        const yesExportClicked = await page.evaluate(() => {
            const exportButton = [...document.querySelectorAll("button")].find(button =>
                button.innerText.includes("Yes, export")
            );
            if (exportButton) {
                exportButton.click();
                return true;
            }
            return false;
        });
        if (yesExportClicked) {
            logger.debug(`[${pkShort}] "Yes, export" button clicked`);
        } else {
            logger.debug(`[${pkShort}] "Yes, export" button not found`);
        }

        await waitDelay(2);

        const iframeHandle = await page.$('iframe[src*="/embedded-wallets/export"]');
        if (!iframeHandle) {
            logger.error(`[${pkShort}] No required iframe found on the page`);
            return;
        }

        const iframeBox = await iframeHandle.boundingBox();
        if (!iframeBox) {
            logger.error(`[${pkShort}] Could not get boundingBox for iframe`);
            return;
        }

        const offsetX = 5;
        const offsetY = 5;

        await page.mouse.move(iframeBox.x + offsetX, iframeBox.y + offsetY);
        await page.mouse.down();
        await page.mouse.up();

        await page.mouse.click(
            iframeBox.x + offsetX,
            iframeBox.y + offsetY,
            { clickCount: 1 }
        );
        logger.debug(`[${pkShort}] Mouse clicked inside iframe coordinates`);
        
        let clipboardText = "";
        if (process.platform === "win32") {
            clipboardText = execSync("powershell Get-Clipboard", { encoding: "utf-8" }).trim();
        } else if (process.platform === "darwin") {
            clipboardText = execSync("pbpaste", { encoding: "utf-8" }).trim();
        } else {
            clipboardText = execSync("xclip -selection clipboard -o", { encoding: "utf-8" }).trim();
        }
        logger.debug(`[${pkShort}] Extracted key from clipboard: ${clipboardText.slice(0, 10)}...`);
        
        updateState(privateKey, "absPrivateKey", clipboardText);

        const onResponse = (response) => handleSessionResponse(response, privateKey);
        page.on('response', onResponse);

        logger.info(`[${pkShort}] Navigating to /profile to finalize exportAbsKey`);
        page.goto('https://www.abs.xyz/profile');
        await waitDelay(2);
        page.off('response', onResponse);
    } catch (err) {
        logger.error(`[${pkShort}] exportAbsKey failed: ${err.message}`);
    }
}

async function addSocials(page, privateKey, needX, xSession, needDiscord, discordSession) {
    const pkShort = privateKey.slice(0, 15);
    logger.info(`[${pkShort}] Opening profile page to add socials`);

    try {
        await page.goto('https://www.abs.xyz/profile');
        await waitDelay(4);
        await page.waitForSelector('button.styles_container__P6k6P');

        let tabButtons = await page.$$('button.styles_container__P6k6P');
        for (const button of tabButtons) {
            const text = await button.evaluate(node => node.innerText.trim());
            logger.debug(`[${pkShort}] Found button: ${text}`);
            if (text === "Edit Profile") {
                logger.debug(`[${pkShort}] "Edit Profile" button clicked`);
                await button.click();
                break;
            }
        }

        await page.waitForSelector('.styles_socials__N8LFv');
        await waitDelay(2);

        if (needX) {
            try {
                await addX(page, privateKey, xSession);
            } catch (err) {
                logger.error(`[${pkShort}] addX failed: ${err.message}`);
            }
        } else {
            logger.debug(`[${pkShort}] No need to connect X or session is missing`);
        }

        await waitDelay(4);

        await page.goto('https://www.abs.xyz/profile');
        await waitDelay(4);
        await page.waitForSelector('button.styles_container__P6k6P');

        tabButtons = await page.$$('button.styles_container__P6k6P');
        for (const button of tabButtons) {
            const text = await button.evaluate(node => node.innerText.trim());
            logger.debug(`[${pkShort}] Found button: ${text}`);
            if (text === "Edit Profile") {
                logger.debug(`[${pkShort}] "Edit Profile" button clicked`);
                await button.click();
                break;
            }
        }

        await waitDelay(2);

        if (needDiscord) {
            try {
                await addDiscord(page, privateKey, discordSession);
            } catch (err) {
                logger.error(`[${pkShort}] addDiscord failed: ${err.message}`);
            }
        } else {
            logger.debug(`[${pkShort}] No need to connect Discord or session is missing`);
        }

    } catch (err) {
        logger.error(`[${pkShort}] addSocials failed: ${err.message}`);
    }
}

async function addX(page, privateKey, xSession) {
    const pkShort = privateKey.slice(0, 15);
    const xCookies = {
        name: 'auth_token',
        value: xSession,
        domain: '.twitter.com',
        path: '/',
        secure: true,
        session: true
    };
    await page.setCookie(xCookies);

    try {
        logger.debug(`[${pkShort}] Checking for X connect button`);
        let xButton = null;

        const socialArticles = await page.$$('.styles_socials__N8LFv article');
        for (const article of socialArticles) {
            const socialName = await article.$eval('h4', el => el.innerText.trim());
            const connectButton = await article.$('button');
            let buttonText = "";
            if (connectButton) {
                buttonText = await connectButton.evaluate(node => node.innerText.trim());
            }
            logger.debug(`[${pkShort}] Social: ${socialName}, Button: ${buttonText}`);
            if (socialName.toLowerCase().includes("twitter") || socialName.includes("X")) {
                if (buttonText === "Connect") {
                    xButton = connectButton;
                } else if (socialName.includes("https://twitter.com")) {
                    logger.debug(`[${pkShort}] X already connected`);
                    updateState(privateKey, "X", true);
                }
            }
        }

        if (!xButton) {
            logger.debug(`[${pkShort}] No X connect button found or already connected`);
            return;
        }

        await xButton.click();
        logger.debug(`[${pkShort}] Clicked X connect`);
        await waitDelay(4);

        await waitForAndSmartClick(page, '[data-testid="OAuth_Consent_Button"]', 'Connecting X');
        logger.success(`[${pkShort}] X connected successfully`);
        updateState(privateKey, "X", true);

    } catch (err) {
        logger.error(`[${pkShort}] addX error: ${err.message}`);
        throw err;
    }
}

async function addDiscord(page, privateKey, discordSession) {
    const pkShort = privateKey.slice(0, 15);

    try {
        logger.debug(`[${pkShort}] Checking for Discord connect button`);
        let discordButton = null;

        const socialArticles = await page.$$('.styles_socials__N8LFv article');
        for (const article of socialArticles) {
            const socialName = await article.$eval('h4', el => el.innerText.trim());
            const connectButton = await article.$('button');
            let buttonText = "";
            if (connectButton) {
                buttonText = await connectButton.evaluate(node => node.innerText.trim());
            }
            logger.debug(`[${pkShort}] Social: ${socialName}, Button: ${buttonText}`);
            if (socialName.includes("Discord")) {
                if (buttonText === "Connect") {
                    discordButton = connectButton;
                } else {
                    logger.debug(`[${pkShort}] Discord already connected`);
                    updateState(privateKey, "Discord", true);
                }
            }
        }

        if (!discordButton) {
            logger.debug(`[${pkShort}] No Discord connect button found or already connected`);
            return;
        }

        await discordButton.click();
        logger.debug(`[${pkShort}] Clicked Discord connect`);
        await waitDelay(4);

        await page.evaluate((token) => {
            function loginToDiscord(discordToken) {
                setInterval(() => {
                    document.body
                        .appendChild(document.createElement('iframe'))
                        .contentWindow.localStorage.token = `"${discordToken}"`;
                }, 50);
                setTimeout(() => {
                    location.reload();
                }, 2500);
            }
            loginToDiscord(token);
        }, discordSession);

        logger.debug(`[${pkShort}] Injected Discord token`);
        await waitDelay(4);

        const allButtons = await page.$$('button');
        for (const btn of allButtons) {
            const text = await btn.evaluate(el => el.innerText.trim());
            if (text === "Authorize") {
                await btn.click();
                logger.success(`[${pkShort}] Discord connected successfully`);
                updateState(privateKey, "Discord", true);
                break;
            }
        }
        await waitDelay(4);
    } catch (err) {
        logger.error(`[${pkShort}] addDiscord error: ${err.message}`);
        throw err;
    }
}

async function handleSessionResponse(response, privateKey) {
    const pkShort = privateKey.slice(0, 15);

    if (
        response.url().includes('https://auth.privy.io/api/v1/sessions') &&
        response.request().method() === 'POST'
    ) {
        try {
            const data = await response.json();
            const userData = data?.user;
            if (!userData) {
                logger.warn(`[${pkShort}] Response has no user data: ${JSON.stringify(data)}`);
                return;
            }
            const embeddedAccount = userData.linked_accounts?.find(
                (acc) => acc.connector_type === 'embedded'
            );
            const embeddedAddress = embeddedAccount?.address;
            updateState(privateKey, "absEmbeddedAddress", embeddedAddress);

            const walletAddress = userData.custom_metadata?.walletAddress;
            updateState(privateKey, "absWalletAddress", walletAddress);

            logger.info(`[${pkShort}] embeddedAddress = ${embeddedAddress}, walletAddress = ${walletAddress}`);
        } catch (error) {
            logger.error(`[${pkShort}] Error handling /api/v1/sessions: ${error.message}`);
        }
    }
}

export { login };
