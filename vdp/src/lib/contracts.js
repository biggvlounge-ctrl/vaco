// VDP — Government Contracts: the AI builds the world through real builders.
//
// Direct instruction (8 Oct 2026): "the government, which is the AI,
// will send out contracts to different builders to continuously
// build the world as needed." A real, repeatable contract lifecycle:
// posted, accepted by a real builder, completed for real pay from the
// governors (`jobs.js`'s `PLANETARY_GOVERNORS_PAYROLL`). What
// specifically gets built is not specified anywhere, so this module
// invents no building target or new property type -- a contract's
// `description` is the caller's own real text, the same openness
// `immigration.js`'s `originRegion`/`religion` already keep.
//
// Posting is the AI government's own act, not a player's -- the real
// caller (`server.cjs`) guards that route with `requireCallingService`
// the same way a scheduler-style world event already is elsewhere in
// this app (`immigration.js`'s `generateMigrationWave`), never a
// player actor.
//
// Same claim-before-pay ordering as every other paid action in this
// directory: materials (if the contract requires any) are spent
// before the VCoin transfer is attempted, and the whole completion is
// rolled back if that transfer then fails.

export const DEFAULT_CONTRACT_REWARD = 40; // flagged interpretive, same footing jobs.js's payPerShift already stands on.

export function createContractsStore() {
  return { contracts: [], nextContractId: 1 };
}

export function postContract(store, {
  description, materialsRequired = {}, vcoinReward = DEFAULT_CONTRACT_REWARD, now = Date.now(),
} = {}) {
  if (!description) throw new Error('postContract requires a description');
  const contract = {
    id: store.nextContractId++,
    description,
    materialsRequired,
    vcoinReward,
    status: 'open',
    builderId: null,
    postedAt: now,
    acceptedAt: null,
    completedAt: null,
  };
  store.contracts.push(contract);
  return contract;
}

export function listOpenContracts(store) {
  return store.contracts.filter((c) => c.status === 'open');
}

export function contractsFor(store, builderId) {
  return store.contracts.filter((c) => c.builderId === builderId);
}

export function acceptContract(store, contractId, { builderId, now = Date.now() } = {}) {
  if (!builderId) throw new Error('acceptContract requires a builderId');
  const contract = store.contracts.find((c) => c.id === contractId);
  if (!contract) throw new Error(`acceptContract: no contract #${contractId}`);
  if (contract.status !== 'open') throw new Error(`acceptContract: contract #${contractId} is not open`);

  contract.status = 'accepted';
  contract.builderId = builderId;
  contract.acceptedAt = now;
  return contract;
}

// `resourcesStore`/`spendMaterialsFn`/`undoSpendFn` are only required
// when the contract itself actually names materials -- the same
// optional-unless-needed wiring `jobs.js`'s `clockOutAndPay` already
// uses, so a materials-free contract never has to fake the wiring.
export async function completeContract(store, contractId, {
  transferFn, resourcesStore, spendMaterialsFn, undoSpendFn, now = Date.now(),
} = {}) {
  const contract = store.contracts.find((c) => c.id === contractId);
  if (!contract) throw new Error(`completeContract: no contract #${contractId}`);
  if (contract.status !== 'accepted') throw new Error(`completeContract: contract #${contractId} is not accepted`);
  if (typeof transferFn !== 'function') throw new Error('completeContract requires a transferFn');

  const needsMaterials = Object.values(contract.materialsRequired || {}).some((amount) => amount > 0);
  if (needsMaterials && (!resourcesStore || typeof spendMaterialsFn !== 'function' || typeof undoSpendFn !== 'function')) {
    throw new Error('completeContract: this contract requires materials, which needs resourcesStore/spendMaterialsFn/undoSpendFn');
  }

  let spendResult = null;
  if (needsMaterials) {
    spendResult = spendMaterialsFn(resourcesStore, contract.builderId, contract.materialsRequired);
  }

  const previousStatus = contract.status;
  contract.status = 'completed';
  contract.completedAt = now;

  try {
    await transferFn({ toUserId: contract.builderId, amount: contract.vcoinReward, reason: `vdp-contract-${contractId}` });
  } catch (err) {
    contract.status = previousStatus;
    contract.completedAt = null;
    if (spendResult) undoSpendFn(resourcesStore, contract.builderId, spendResult);
    throw err;
  }

  return contract;
}
