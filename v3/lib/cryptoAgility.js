// V3 — Crypto-agility layer.
// Source of truth: QVAN_SECURITY_RESILIENCE_SCOPE.md §2: "build
// crypto-agility now -- architect V3 and VACA's cryptographic layer so
// the algorithm is a configuration setting, not hardcoded. Migrates
// via config change later; hardcoded requires a full rewrite. Cheap
// now, expensive to retrofit."
//
// **Why this exists before any crypto is actually used**: V3 had no
// cryptographic layer at all when this was written. That is precisely
// why it was cheap -- there was nothing hardcoded to retrofit. The
// rule this establishes: nothing in V3 ever calls a crypto primitive
// directly. Everything goes through `signPayload`/`verifySignature`/
// `hashPayload` below, which resolve the algorithm from configuration
// at call time. When NIST PQC lands in Node, migrating is an env var,
// not a rewrite.
//
// **Real threat being defended against** (from the source doc):
// "harvest now, decrypt later" -- V3 is a financial ledger requiring
// long-term confidentiality, which makes it a genuine target for
// capture-now-decrypt-in-2033+ attacks.
//
// **Honest status of the PQC algorithms below, verified directly, not
// assumed**: Node 22 does NOT ship ML-DSA or ML-KEM. They are
// registered here as real, NIST-standardized, named slots with
// `available: false`, and asking for one throws a clear, actionable
// error. They are never silently downgraded to a classical algorithm
// and never faked -- a fabricated "post-quantum" signature would be
// worse than no signature, because it would look safe.

const crypto = require('crypto');

//: Real NIST post-quantum standards, finalized August 2024 (per the
//: source doc). Named now so the migration target is unambiguous.
const SIGNATURE_ALGORITHMS = {
  ed25519: {
    kind: 'classical',
    available: true,
    nistStandard: null,
    note: 'Real, fast, widely deployed. Quantum-vulnerable (Shor). Fine until PQC is reachable.',
  },
  'ecdsa-p256': {
    kind: 'classical',
    available: true,
    nistStandard: 'FIPS 186-5',
    note: 'Real. Explicitly phased out starting 2030, disallowed 2035, per the source doc.',
  },
  'ml-dsa-65': {
    kind: 'post-quantum',
    available: false,
    nistStandard: 'FIPS 204',
    note: 'The real migration target for signatures. Not in Node 22 stdlib -- needs a newer Node or a vetted library.',
  },
};

//: Hashes are a genuinely different story from signatures and it's
//: worth not overstating the risk: Grover's algorithm gives only a
//: quadratic speedup, so SHA-256 retains ~128-bit effective security
//: against a quantum attacker and remains acceptable. SHA3-384/512 is
//: the higher-margin choice for long-lived data. Stated accurately
//: rather than implying SHA-256 is broken.
const HASH_ALGORITHMS = {
  'sha256': { available: true, quantumEffectiveBits: 128, note: 'Acceptable post-quantum; Grover is only quadratic.' },
  'sha3-256': { available: true, quantumEffectiveBits: 128, note: 'SHA-3 family, real alternative construction.' },
  'sha3-512': { available: true, quantumEffectiveBits: 256, note: 'Higher margin for long-lived ledger data.' },
};

const DEFAULT_SIGNATURE_ALGORITHM = 'ed25519';
const DEFAULT_HASH_ALGORITHM = 'sha3-512';

class CryptoAlgorithmUnavailableError extends Error {}

//: The one real configuration point. Reading from the environment at
//: call time (not module load) is deliberate -- it means a migration
//: is a restart, and it keeps this testable without mutating module
//: state.
function getActiveSignatureAlgorithm() {
  return process.env.V3_SIGNATURE_ALGORITHM || DEFAULT_SIGNATURE_ALGORITHM;
}

function getActiveHashAlgorithm() {
  return process.env.V3_HASH_ALGORITHM || DEFAULT_HASH_ALGORITHM;
}

function requireSignatureAlgorithm(name) {
  const spec = SIGNATURE_ALGORITHMS[name];
  if (!spec) {
    throw new CryptoAlgorithmUnavailableError(
      `unknown signature algorithm "${name}" (known: ${Object.keys(SIGNATURE_ALGORITHMS).join(', ')})`
    );
  }
  if (!spec.available) {
    throw new CryptoAlgorithmUnavailableError(
      `signature algorithm "${name}" (${spec.nistStandard}) is a real NIST standard but is not available in this runtime: ${spec.note} ` +
      'Refusing to silently fall back to a classical algorithm -- a fabricated post-quantum signature would look safe while providing none.'
    );
  }
  return spec;
}

function generateKeyPair(algorithm = getActiveSignatureAlgorithm()) {
  requireSignatureAlgorithm(algorithm);
  if (algorithm === 'ed25519') return crypto.generateKeyPairSync('ed25519');
  if (algorithm === 'ecdsa-p256') return crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  throw new CryptoAlgorithmUnavailableError(`no key generation path wired for "${algorithm}"`);
}

//: Every signature records which algorithm produced it. Without this,
//: a future migration cannot tell which stored signatures are still
//: verifiable under the new algorithm and which need re-signing --
//: the single most common thing that makes a crypto migration
//: painful.
function signPayload(payload, privateKey, algorithm = getActiveSignatureAlgorithm()) {
  requireSignatureAlgorithm(algorithm);
  const data = Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload));
  const signature = algorithm === 'ed25519'
    ? crypto.sign(null, data, privateKey)
    : crypto.sign('sha256', data, privateKey);
  return { algorithm, signature: signature.toString('base64'), signedAt: Date.now() };
}

function verifySignature(payload, signatureRecord, publicKey) {
  if (!signatureRecord || !signatureRecord.algorithm || !signatureRecord.signature) {
    throw new Error('verifySignature requires a signature record with { algorithm, signature }');
  }
  requireSignatureAlgorithm(signatureRecord.algorithm);
  const data = Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload));
  const sig = Buffer.from(signatureRecord.signature, 'base64');
  return signatureRecord.algorithm === 'ed25519'
    ? crypto.verify(null, data, publicKey, sig)
    : crypto.verify('sha256', data, publicKey, sig);
}

function hashPayload(payload, algorithm = getActiveHashAlgorithm()) {
  const spec = HASH_ALGORITHMS[algorithm];
  if (!spec) {
    throw new CryptoAlgorithmUnavailableError(
      `unknown hash algorithm "${algorithm}" (known: ${Object.keys(HASH_ALGORITHMS).join(', ')})`
    );
  }
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return { algorithm, hash: crypto.createHash(algorithm).update(data).digest('hex') };
}

//: A real, honest self-report of where this app stands on the
//: migration -- so "are we PQC-ready yet" is answerable without
//: reading code. Surfaced through the API so it's checkable in a live
//: deployment, not just locally.
function describeCryptoPosture() {
  const sigName = getActiveSignatureAlgorithm();
  const sigSpec = SIGNATURE_ALGORITHMS[sigName];
  return {
    activeSignatureAlgorithm: sigName,
    activeSignatureKind: sigSpec ? sigSpec.kind : 'unknown',
    activeHashAlgorithm: getActiveHashAlgorithm(),
    postQuantumReady: Boolean(sigSpec && sigSpec.kind === 'post-quantum'),
    cryptoAgile: true,
    migrationTarget: 'ml-dsa-65',
    migrationBlockedBy: SIGNATURE_ALGORITHMS['ml-dsa-65'].available
      ? null
      : 'ML-DSA (FIPS 204) is not available in this Node runtime yet',
    // Real, dated context from the source doc, so the deadline isn't lore.
    classicalPhaseOutBegins: 2030,
    classicalDisallowed: 2035,
  };
}

module.exports = {
  SIGNATURE_ALGORITHMS,
  HASH_ALGORITHMS,
  DEFAULT_SIGNATURE_ALGORITHM,
  DEFAULT_HASH_ALGORITHM,
  CryptoAlgorithmUnavailableError,
  getActiveSignatureAlgorithm,
  getActiveHashAlgorithm,
  generateKeyPair,
  signPayload,
  verifySignature,
  hashPayload,
  describeCryptoPosture,
};
