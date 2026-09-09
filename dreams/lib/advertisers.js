// DREAMS -- advertiser sign-up. The first real step of the self-serve
// flow: an advertiser (any business or seller, not just a screen
// owner) creates a real account before they can create a campaign.

function signUpAdvertiser(store, options = {}) {
  const { advertiserId, businessName, now = Date.now() } = options;

  if (!advertiserId) throw new Error('signUpAdvertiser requires an advertiserId');
  if (!businessName) throw new Error('signUpAdvertiser requires a businessName');
  if (store.advertisers.find((a) => a.advertiserId === advertiserId)) {
    throw new Error(`signUpAdvertiser: advertiser "${advertiserId}" already signed up`);
  }

  const advertiser = { advertiserId, businessName, createdAt: now };
  store.advertisers.push(advertiser);
  return advertiser;
}

function getAdvertiser(store, advertiserId) {
  return store.advertisers.find((a) => a.advertiserId === advertiserId) || null;
}

module.exports = { signUpAdvertiser, getAdvertiser };
