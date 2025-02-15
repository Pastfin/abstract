import Web3 from 'web3';
import { HttpsProxyAgent } from 'https-proxy-agent';

function createWeb3Instance(rpc, proxyUrl) {
  if (proxyUrl) {
    const agent = new HttpsProxyAgent(proxyUrl);
    const providerOptions = {
      keepAlive: true,
      httpsAgent: agent
    };
    return new Web3(new Web3.providers.HttpProvider(rpc, providerOptions));
  } else {
    return new Web3(new Web3.providers.HttpProvider(rpc));
  }
}

function prepareProxyURL(prox) {
  const parts = prox.split(':');
  if (parts.length < 2) {
      throw new Error(`Invalid proxy format: ${prox}`);
  }
  const [ip, port, user, pass] = parts;
  const proxyUrl = `http://${user}:${pass}@${ip}:${port}`;
  return proxyUrl;
}

export { createWeb3Instance, prepareProxyURL };

