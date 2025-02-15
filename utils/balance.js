import { tokensJson, erc20ABI, RPC, stateJson } from './constants.js';
import { updateState } from './dataHandler.js';
import { createWeb3Instance, prepareProxyURL } from './misc.js';

async function updateBalanceState(privateKey, proxyStr, rpc = RPC) {
    const publicKey = stateJson[privateKey]['absWalletAddress'];

    for (let i = 0; i < tokensJson.length; i++) {
        const tokenData = tokensJson[i];
        const balance = await getTokenBalance(tokenData.contract, publicKey, proxyStr, rpc);
        updateState(privateKey, tokenData.name, balance);
    }
}

async function getTokenBalance(tokenContract, publicKey, proxy = null, rpc = RPC) {
    if (tokenContract === '0x0000000000000000000000000000000000000000') {
        return await getNativeBalance(publicKey, proxy, rpc);
    }
    
    const proxyURL = prepareProxyURL(proxy);
    const web3 = createWeb3Instance(rpc, proxyURL);
    const contract = new web3.eth.Contract(erc20ABI, tokenContract);

    const balanceBN = await contract.methods.balanceOf(publicKey).call();
    const decimals = await contract.methods.decimals().call();

    const balance = BigInt(balanceBN);
    const dec = parseInt(decimals, 10);

    const integerPart = balance / BigInt(10 ** dec);
    const fractionPart = balance % BigInt(10 ** dec);
    const fractionStr = fractionPart.toString().padStart(dec, '0');

    return dec === 0
        ? integerPart.toString()
        : `${integerPart.toString()}.${fractionStr}`;
}

async function getNativeBalance(userAddress, proxy = null, rpc = RPC) {
    const proxyURL = prepareProxyURL(proxy);
    const web3 = createWeb3Instance(rpc, proxyURL);
    const balanceWei = await web3.eth.getBalance(userAddress);
    return web3.utils.fromWei(balanceWei, 'ether');
}

export { updateBalanceState, getTokenBalance, getNativeBalance };
