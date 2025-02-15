import { connect } from 'puppeteer-real-browser';
import { dirname } from "path";
import { fileURLToPath } from "url";
import { logger } from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function loadBrowser(proxyOptions, userAgent, privateKey) {
    let browser;
    const pkShort = privateKey.slice(0, 15);
    try {
        const metamaskPath = __dirname + '\\metamask';
        const connectOptions = {
            headless: false,
            turnstile: true,
            args: [
                '--window-size=1280,1024',
                `--disable-extensions-except=${metamaskPath}`,
                `--load-extension=${metamaskPath}`,
                `--user-agent=${userAgent}`
            ],
            connectOption: {
                defaultViewport: null
            }
        };

        if (proxyOptions) {
            connectOptions.proxy = {
                host: proxyOptions.host,
                port: proxyOptions.port,
                username: proxyOptions.username,
                password: proxyOptions.password
            };
        }

        const { page, browser: launchedBrowser } = await connect(connectOptions);
        browser = launchedBrowser;
        logger.success(`[${pkShort}] Browser launched successfully`);

        return { page,  browser};
    } catch (error) {
        logger.error(`Error in loadBrowser function: ${error.message}`);
        if (browser) {
            await browser.close();
        }
        throw error;
    }
}

async function waitForAndClick(page, selector, description) {
    try {
        logger.debug(`Starting click on: ${description} ${selector}`);
        await page.waitForSelector(selector);
        await page.click(selector);
        logger.debug(`Clicked on: ${description}`);
    } catch (error) {
        logger.error(`Error click: ${selector} - ${error.message}`);
        throw error; 
    }
}

async function typeInput(page, selector, value, description) {
    try {
        await page.waitForSelector(selector, { visible: true, timeout: 20000 });
        await page.type(selector, value);
        logger.debug(`Typed value in: ${description}`);
    } catch (error) {
        logger.error(`Error typing in: ${selector} - ${error.message}`);
        throw error; 
    }
}

async function waitForAndSmartClick(page, selector, description) {
    try {
        await page.waitForSelector(selector, { visible: true, timeout: 20000 });
        await page.realClick(selector);
        logger.debug(`Clicked on: ${description}`);
    } catch (error) {
        logger.error(`Error click: ${selector} - ${error.message}`);
        throw error; 
    }
}


export { loadBrowser, waitForAndClick, typeInput, waitForAndSmartClick };
