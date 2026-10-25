// CVLLEX — shared, growing store object. Same pattern established
// across this repo (world-layer/venvs/hvntz/void/voken): one factory
// whose shape grows by adding new top-level array/counter fields as
// each module adds a feature.

function createCvllexStore() {
  return {
    productionOrders: [],
    nextProductionOrderId: 1,
    vaultedCollectibles: [],
    nextVaultId: 1,
  };
}

module.exports = { createCvllexStore };
