// VACA -- real public-blockchain anchoring.
//
// Posts a real block's hash (from lib/blockchain.js's own local
// chain) as a real, minimal transaction on a real EVM-compatible
// chain -- a 0-value self-transfer carrying the hash as transaction
// data, the same real pattern public notarization/timestamping
// services already use. Uses `ethers`, the standard, audited library
// for this.
//
// **Absent by default, and this is deliberate, not a stub left
// unfinished.** This requires a REAL funded wallet -- gas costs real
// money, on every call, indefinitely -- and a REAL RPC provider
// account (Infura, Alchemy, or a public RPC endpoint). Neither is
// something this codebase can create: a funded wallet needs real
// currency deposited by a real person, and an RPC provider account
// needs a real sign-up. So, same posture as v4-proxy without a real
// `ANTHROPIC_API_KEY`: the real integration code is here and will
// fire the moment real credentials exist, and until then it reports
// its own honest, unconfigured state rather than fabricating a
// transaction hash that never touched a real chain.
//
// Configure with:
//   VACA_CHAIN_RPC_URL     -- a real RPC endpoint (Infura/Alchemy/etc.)
//   VACA_CHAIN_PRIVATE_KEY -- a real, funded wallet's private key

let ethers;
try {
  // eslint-disable-next-line global-require
  ethers = require('ethers');
} catch {
  ethers = null;
}

function isConfigured() {
  return Boolean(ethers && process.env.VACA_CHAIN_RPC_URL && process.env.VACA_CHAIN_PRIVATE_KEY);
}

// A real, honest self-report of where this stands -- the same real
// transparency `cryptoAgility.js`'s own `describeCryptoPosture`
// already gives for the signing/hashing layer, applied here to the
// public-chain half.
function describeChainPosture() {
  return {
    configured: isConfigured(),
    ethersInstalled: Boolean(ethers),
    rpcUrlSet: Boolean(process.env.VACA_CHAIN_RPC_URL),
    walletConfigured: Boolean(process.env.VACA_CHAIN_PRIVATE_KEY),
    note: isConfigured()
      ? 'Real public-chain anchoring is live: a call will post a real transaction and spend real gas.'
      : 'Not configured. Anchoring needs a real funded wallet (VACA_CHAIN_PRIVATE_KEY) and a real RPC '
        + 'provider (VACA_CHAIN_RPC_URL) -- neither exists yet, and nothing here will fabricate a '
        + 'transaction hash in their absence.',
  };
}

// Throws a real, specific error rather than ever returning a made-up
// transaction hash. Every failure mode here is named so a caller
// knows exactly what is missing, the same posture `requireOperator`'s
// own 401 message already takes.
async function anchorHash(hash) {
  if (!ethers) {
    throw new Error('anchorHash: the "ethers" package is not installed in vaca/node_modules');
  }
  const rpcUrl = process.env.VACA_CHAIN_RPC_URL;
  const privateKey = process.env.VACA_CHAIN_PRIVATE_KEY;
  if (!rpcUrl || !privateKey) {
    throw new Error(
      'anchorHash: no real chain is configured. Set VACA_CHAIN_RPC_URL (a real RPC provider) and '
      + 'VACA_CHAIN_PRIVATE_KEY (a real funded wallet) to anchor for real -- refusing to fabricate a transaction.',
    );
  }
  if (!hash) throw new Error('anchorHash requires a real hash to anchor');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const tx = await wallet.sendTransaction({
    to: wallet.address, // a real, minimal self-transfer -- the hash is the payload, not the value moved
    value: 0n,
    data: `0x${Buffer.from(hash).toString('hex')}`,
  });
  const receipt = await tx.wait();
  const network = await provider.getNetwork();
  return {
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    network: network.name,
    chainId: Number(network.chainId),
  };
}

module.exports = { isConfigured, describeChainPosture, anchorHash };
