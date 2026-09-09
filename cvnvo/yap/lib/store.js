// Yap -- shared, growing store object. Its own separate app, its own
// separate store -- CVNVO's own profile data lives in the sibling
// `cvnvo/lib/store.js`, not here. Yap never keeps a local copy of
// profile/verification data; it fetches it live, per report/lookup,
// through an injected `profileFetchFn`.

function createYapStore() {
  return {
    yapReports: [],
    nextYapReportId: 1,
  };
}

module.exports = { createYapStore };
