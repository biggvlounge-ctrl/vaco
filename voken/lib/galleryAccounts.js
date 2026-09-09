// VOKEN — VADO gallery accounts.
// Source of truth: VOKEN_MASTER_SPEC_PROGRESS.md: collectors browsing
// VADO get a real gallery account and a real holdings view of what art
// they actually own -- not a generic wallet view. Holdings are a real
// aggregation query over the existing `cultureCards`/`editions`
// ownership data already maintained by `cultureCards.js`; no separate
// ownership ledger is created here.

function registerGalleryAccount(store, options = {}) {
  const { userId, displayName } = options;
  if (!userId) throw new Error('registerGalleryAccount requires a userId');
  const account = { id: store.nextGalleryAccountId++, userId, displayName: displayName || userId, createdAt: Date.now() };
  store.galleryAccounts.push(account);
  return account;
}

function getGalleryAccount(store, accountId) {
  return store.galleryAccounts.find((a) => a.id === accountId) || null;
}

function getGalleryHoldings(store, options = {}) {
  const { userId } = options;
  if (!userId) throw new Error('getGalleryHoldings requires a userId');

  const holdings = [];
  for (const card of store.cultureCards) {
    if (card.category !== 'art') continue;
    for (const edition of card.editions) {
      if (edition.ownerId === userId) {
        holdings.push({ cardId: card.id, editionNumber: edition.editionNumber, format: edition.format });
      }
    }
  }
  return { userId, holdings };
}

module.exports = { registerGalleryAccount, getGalleryAccount, getGalleryHoldings };
