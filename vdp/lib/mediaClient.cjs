// VACO -- the client every app uses to reach vaco-media.
//
// **Fails soft, and that is the argument.** This is the opposite call
// from `decisionLog.js`, and the difference is worth stating because
// both are cross-app calls that could plausibly go either way.
//
// A decision record is evidence: an unattributed settlement cannot be
// repaired afterwards, so the route refuses rather than proceed. A
// media session is a *feature*. If vaco-media is down, a speed date
// cannot show video -- but the date, the match, the payment and the
// scheduling are all still real and all still work. Refusing the whole
// interaction because the camera cannot connect would take a degraded
// product and make it a broken one.
//
// So: `null` on failure, never a throw, and the caller decides what a
// missing session means for its own domain. `describe()` keeps the
// failures visible so "media has been down for three days" is a fact
// somebody can see rather than a thing users report.
//
// The one exception is `playbackUrl`, which is documented at the call.

const DEFAULT_URL = 'http://localhost:8821';

function createMediaClient(options = {}) {
  const {
    app,
    url = process.env.VACO_MEDIA_URL || DEFAULT_URL,
    serviceName = process.env.VACO_SERVICE_NAME || app,
    serviceToken = process.env.VACO_SERVICE_TOKEN || '',
    fetchFn = globalThis.fetch,
    timeoutMs = 3000,
  } = options;

  if (!app) throw new Error('createMediaClient requires the calling app name');

  let ok = 0;
  const failures = [];

  function headers() {
    return {
      'Content-Type': 'application/json',
      ...(serviceToken ? { 'X-Service-Name': serviceName, 'X-Service-Token': serviceToken } : {}),
    };
  }

  async function call(method, path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchFn(`${url}${path}`, {
        method, signal: controller.signal, headers: headers(),
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const parsed = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(parsed.error || `vaco-media answered ${res.status}`);
      ok += 1;
      return parsed;
    } catch (err) {
      const reason = err.name === 'AbortError' ? `no answer within ${timeoutMs}ms` : err.message;
      failures.push({ path, reason, at: Date.now() });
      if (failures.length > 50) failures.shift();
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  // -- Live sessions ----------------------------------------------------

  // Addressed by the caller's own id, so a consumer never stores ours.
  const openSession = (externalId, kind, extra = {}) =>
    call('POST', '/api/sessions', { externalId: String(externalId), kind, ...extra });

  // Returns `{ grant, credential }`. The credential is handed to the
  // participant's client and is the only thing that lets them in.
  const inviteParticipant = (sessionId, participantId, extra = {}) =>
    call('POST', `/api/sessions/${sessionId}/grants`, { participantId: String(participantId), ...extra });

  const endSession = (sessionId) => call('POST', `/api/sessions/${sessionId}/end`);
  const sessionState = (externalId) =>
    call('GET', `/api/sessions/by-app/${encodeURIComponent(app)}/${encodeURIComponent(externalId)}`);
  const startRecording = (sessionId) => call('POST', `/api/sessions/${sessionId}/recording/start`);

  // -- Recorded assets ---------------------------------------------------

  const registerAsset = (externalId, kind, ownerId, extra = {}) =>
    call('POST', '/api/assets', { externalId: String(externalId), kind, ownerId: String(ownerId), ...extra });

  const assetState = (externalId) =>
    call('GET', `/api/assets/by-app/${encodeURIComponent(app)}/${encodeURIComponent(externalId)}`);

  const markReady = (assetId) => call('POST', `/api/assets/${assetId}/ready`);
  const attachStorage = (assetId, body) => call('POST', `/api/assets/${assetId}/storage`, body);
  const removeAsset = (assetId, reason) => call('POST', `/api/assets/${assetId}/remove`, { reason });

  // Returns `{ grant, credential }`. **The caller must have decided the
  // viewer is entitled before calling this** -- vaco-media holds no
  // subscription state and makes no policy. Vvltvre Flix checks the
  // tier and the concurrent-stream limit; this only issues the ticket.
  const grantPlayback = (assetId, viewerId, extra = {}) =>
    call('POST', `/api/assets/${assetId}/playback-grants`, { viewerId: String(viewerId), ...extra });

  const activePlaybackFor = (viewerId) =>
    call('GET', `/api/viewers/${encodeURIComponent(String(viewerId))}/active-playback`);

  function describe() {
    return {
      url,
      ok,
      failed: failures.length,
      recentFailures: failures.slice(-5),
      // Soft failure is a deliberate choice, not an accident -- said
      // out loud on the health endpoint so nobody reads a run of
      // failures as "working".
      posture: 'fail-soft: media is a feature, not a settlement. Failures return null.',
    };
  }

  return {
    openSession, inviteParticipant, endSession, sessionState, startRecording,
    registerAsset, assetState, markReady, attachStorage, removeAsset,
    grantPlayback, activePlaybackFor,
    describe,
  };
}

module.exports = { createMediaClient };
