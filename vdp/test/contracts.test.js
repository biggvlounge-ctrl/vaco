'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createContractsStore, postContract, listOpenContracts, contractsFor, acceptContract,
  completeContract, DEFAULT_CONTRACT_REWARD,
} from '../src/lib/contracts.js';

function fakeTransfer(calls, { shouldFail = false } = {}) {
  return async (args) => {
    calls.push(args);
    if (shouldFail) throw new Error('transfer failed');
    return { ok: true };
  };
}

function fakeSpend(calls, { shouldFail = false } = {}) {
  return (resourcesStore, entityId, requested) => {
    if (shouldFail) throw new Error('short on materials');
    calls.push({ entityId, requested });
    return { spent: requested, perType: {}, fromOldWorldStock: 0, oldWorldStockRemaining: 0 };
  };
}

test('postContract creates a real, open contract with no builder yet', () => {
  const store = createContractsStore();
  const contract = postContract(store, { description: 'clear a new frontier plot' });
  assert.equal(contract.status, 'open');
  assert.equal(contract.builderId, null);
  assert.equal(contract.vcoinReward, DEFAULT_CONTRACT_REWARD);
  assert.deepEqual(listOpenContracts(store), [contract]);
});

test('postContract requires a description', () => {
  const store = createContractsStore();
  assert.throws(() => postContract(store, {}), /requires a description/);
});

test('acceptContract assigns a real builder and moves the contract out of the open list', () => {
  const store = createContractsStore();
  const contract = postContract(store, { description: 'build a well' });
  const accepted = acceptContract(store, contract.id, { builderId: 'alice' });
  assert.equal(accepted.status, 'accepted');
  assert.equal(accepted.builderId, 'alice');
  assert.equal(listOpenContracts(store).length, 0);
  assert.deepEqual(contractsFor(store, 'alice'), [accepted]);
});

test('acceptContract refuses an unknown contract and one already accepted', () => {
  const store = createContractsStore();
  const contract = postContract(store, { description: 'x' });
  acceptContract(store, contract.id, { builderId: 'alice' });
  assert.throws(() => acceptContract(store, contract.id, { builderId: 'bob' }), /is not open/);
  assert.throws(() => acceptContract(store, 9999, { builderId: 'alice' }), /no contract/);
});

test('completeContract pays the real builder and marks the contract completed, no materials needed', async () => {
  const store = createContractsStore();
  const contract = postContract(store, { description: 'x', vcoinReward: 25 });
  acceptContract(store, contract.id, { builderId: 'alice' });
  const calls = [];
  const completed = await completeContract(store, contract.id, { transferFn: fakeTransfer(calls) });
  assert.equal(completed.status, 'completed');
  assert.equal(calls[0].toUserId, 'alice');
  assert.equal(calls[0].amount, 25);
});

test('completeContract spends real materials before paying when the contract requires them', async () => {
  const store = createContractsStore();
  const contract = postContract(store, { description: 'x', materialsRequired: { wood: 20, stone: 5 } });
  acceptContract(store, contract.id, { builderId: 'alice' });
  const spendCalls = [];
  const transferCalls = [];
  await completeContract(store, contract.id, {
    transferFn: fakeTransfer(transferCalls),
    resourcesStore: {},
    spendMaterialsFn: fakeSpend(spendCalls),
    undoSpendFn: () => {},
  });
  assert.deepEqual(spendCalls[0].requested, { wood: 20, stone: 5 });
  assert.equal(transferCalls.length, 1);
});

test('completeContract requires materials wiring when the contract names materials', async () => {
  const store = createContractsStore();
  const contract = postContract(store, { description: 'x', materialsRequired: { wood: 5 } });
  acceptContract(store, contract.id, { builderId: 'alice' });
  await assert.rejects(
    completeContract(store, contract.id, { transferFn: fakeTransfer([]) }),
    /requires materials/,
  );
});

test('a failed completeContract rolls back the materials spend and the contract status', async () => {
  const store = createContractsStore();
  const contract = postContract(store, { description: 'x', materialsRequired: { wood: 5 } });
  acceptContract(store, contract.id, { builderId: 'alice' });
  const undoCalls = [];
  await assert.rejects(
    completeContract(store, contract.id, {
      transferFn: fakeTransfer([], { shouldFail: true }),
      resourcesStore: {},
      spendMaterialsFn: fakeSpend([]),
      undoSpendFn: (...args) => undoCalls.push(args),
    }),
  );
  assert.equal(store.contracts[0].status, 'accepted');
  assert.equal(undoCalls.length, 1);
});

test('completeContract refuses a contract that was never accepted', async () => {
  const store = createContractsStore();
  const contract = postContract(store, { description: 'x' });
  await assert.rejects(
    completeContract(store, contract.id, { transferFn: fakeTransfer([]) }),
    /is not accepted/,
  );
});
