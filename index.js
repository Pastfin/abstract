
import { logger } from './utils/logger.js';
import { start } from './core/manager.js';
import { validateExcelFile, validateConfig } from './utils/setupCheck.js';

async function main() {
    const isExcelFileValid = await validateExcelFile();
    const isConfigFileValid = validateConfig();

    if (!isExcelFileValid || !isConfigFileValid) {
        logger.info('Need to fix errors first.');
        return;
    }

    await start();
}

main();
