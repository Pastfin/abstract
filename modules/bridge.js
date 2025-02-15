import axios from 'axios';
import { CHAINS, stateJson } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { createWeb3Instance, prepareProxyURL } from '../utils/misc.js';
import { waitDelay } from '../utils/delay.js';


async function bridgeToAbstract(privateKey, amount, chainFrom, proxyStr) {
    const pkShort = privateKey.slice(0, 15);
    const normalizedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

    try {
        logger.info(`[${pkShort}] bridgeToAbstract started (amount: ${amount}, chainFrom: ${chainFrom})`);
        const chainConfig = CHAINS[chainFrom.toUpperCase()];
        if (!chainConfig) {
            throw new Error(`Unknown chain: ${chainFrom}`);
        }
        
        const proxyURL = prepareProxyURL(proxyStr);

        const web3 = createWeb3Instance(chainConfig.rpc, proxyURL);
        const account = web3.eth.accounts.privateKeyToAccount(normalizedPrivateKey);

        const userState = stateJson[privateKey];
        if (!userState || !userState.absWalletAddress) {
            throw new Error(`No absWalletAddress found in stateJson for this privateKey`);
        }

        const payload = {
            user: account.address,
            originChainId: chainConfig.id,
            destinationChainId: 2741,
            originCurrency: '0x0000000000000000000000000000000000000000',
            destinationCurrency: '0x0000000000000000000000000000000000000000',
            recipient: userState.absWalletAddress,
            tradeType: 'EXACT_INPUT',
            amount: web3.utils.toWei(String(amount), 'ether'),
            useExternalLiquidity: false,
        };

        const headers = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        };

        const agent = new HttpsProxyAgent(proxyURL);

        const response = await axios.post('https://api.relay.link/quote', payload, { headers, httpsAgent: agent });
        const txData = response.data.steps[0].items[0].data;

        const gasEstimate = await web3.eth.estimateGas({
            from: account.address,
            to: txData.to,
            value: txData.value,
            data: txData.data,
        });

        const gasMultiplier = 1.1;
        const gasLimit = Math.floor(parseFloat(gasEstimate) * gasMultiplier);

        const txParams = {
            chainId: Number(txData.chainId),
            from: account.address,
            to: txData.to,
            value: txData.value,
            data: txData.data,
            gas: gasLimit,
            maxFeePerGas: Math.floor(parseFloat(txData.maxFeePerGas) * gasMultiplier),
            maxPriorityFeePerGas: Math.floor(parseFloat(txData.maxPriorityFeePerGas) * gasMultiplier),
            nonce: await web3.eth.getTransactionCount(account.address, 'pending'),
        };

        const signedTx = await account.signTransaction(txParams);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        await waitDelay(4);
        logger.success(`[${pkShort}] Bridge transaction sent. Hash: ${receipt.transactionHash}`);
        return receipt.transactionHash;
    } catch (error) {
        logger.error(`[${pkShort}] Error in bridgeToAbstract: ${error.message || error}`);
    }
}

export { bridgeToAbstract };
