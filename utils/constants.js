import fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const __projectPath = path.join(__dirname, '..');

const stateFilePath = path.join(__dirname, '..', 'data', 'state.json');
const tokensFilePath = path.join(__dirname, '..', 'data', 'tokens.json');
const configFilePath = path.join(__dirname, '..', 'config.json');
const logFilePath = path.join(__dirname, '..', 'logs/app.log');

const rawstateFileData = fs.readFileSync(stateFilePath, 'utf-8');
const stateJson = JSON.parse(rawstateFileData);

const tokensFileData = fs.readFileSync(tokensFilePath, 'utf-8');
const tokensJson = JSON.parse(tokensFileData);

const configFileData = fs.readFileSync(configFilePath, 'utf-8');
const configJson = JSON.parse(configFileData);

const RPC = 'https://api.mainnet.abs.xyz/';

const erc20ABI = [
    {
      constant: true,
      inputs: [{ name: '_owner', type: 'address' }],
      name: 'balanceOf',
      outputs: [{ name: 'balance', type: 'uint256' }],
      type: 'function'
    },
    {
      constant: true,
      inputs: [],
      name: 'decimals',
      outputs: [{ name: '', type: 'uint8' }],
      type: 'function'
    }
];

const CHAINS = {
    "OP": {
        "id": 10,
        "rpc": "https://optimism.drpc.org"
    },
    "ARB": {
        "id": 42161,
        "rpc": "https://arbitrum.drpc.org"
    },
    "BASE": {
        "id": 8453,
        "rpc": "https://base.drpc.org"
    }
}

export { stateJson, tokensJson, RPC, erc20ABI, stateFilePath, CHAINS, configJson, logFilePath, __projectPath }