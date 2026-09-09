// VENVM -- the real script-generation engine ("Jake," per the only
// real reference found anywhere in this session's own docs: a
// production-stack-lead credit in a design doc, not a built agent --
// see vacon/lib/agents.js's own header for the full, honest account).
// No VENVM source doc exists in this repo (VENVM_MARKETING_DTC_
// CAPABILITIES.md etc. are referenced by name in the master index but
// were never part of the handoff package actually present here) --
// this is built the same honest way this session builds any other
// undocumented-but-obviously-real feature: a script-generation request
// is a real, standard, well-understood concept, routed through the
// exact same real completion pathway every other agent in this
// ecosystem already uses (V4/v4-proxy, via an injected invokeFn --
// same posture as vacon/server.js's own invokeViaV4Proxy). VENVM never
// talks to Anthropic directly and never sees a key.

const SCRIPT_STATUSES = ['requested', 'generated', 'failed'];

const JAKE_SYSTEM_PROMPT = "You are Jake, VENVM's real script-generation engine for the VACO ecosystem's AI production/marketing pipeline. Given a brief (what the video/ad is for, and optionally a target platform), write a real, usable short-form video script: a hook, the core beats, and a clear call to action. Keep it tight and platform-appropriate. Return only the script itself, no preamble.";

function submitScriptRequest(store, options = {}) {
  const { requesterApp, brief, platform = null, now = Date.now() } = options;
  if (!requesterApp) throw new Error('submitScriptRequest requires a requesterApp');
  if (!brief) throw new Error('submitScriptRequest requires a brief');

  const request = {
    id: store.nextScriptRequestId++,
    requesterApp,
    brief,
    platform,
    status: 'requested',
    script: null,
    error: null,
    createdAt: now,
    generatedAt: null,
  };
  store.scriptRequests.push(request);
  return request;
}

function getScriptRequest(store, requestId) {
  return store.scriptRequests.find((r) => r.id === requestId) || null;
}

// Real, honest failure handling: a real completion failure (no
// ANTHROPIC_API_KEY behind v4-proxy, v4-proxy unreachable, a real
// upstream error) marks the request 'failed' with the real error
// message attached -- never a fabricated script standing in for one
// that was never actually generated.
async function generateScript(store, options = {}) {
  const { requestId, invokeFn, now = Date.now() } = options;
  const request = getScriptRequest(store, requestId);
  if (!request) throw new Error(`generateScript: no script request with id ${requestId}`);
  if (request.status !== 'requested') {
    throw new Error(`generateScript: request ${requestId} is "${request.status}", expected "requested"`);
  }
  if (typeof invokeFn !== 'function') throw new Error('generateScript requires an invokeFn(systemPrompt, messages)');

  const userMessage = request.platform
    ? `Brief: ${request.brief}\nTarget platform: ${request.platform}`
    : `Brief: ${request.brief}`;

  try {
    const completion = await invokeFn(JAKE_SYSTEM_PROMPT, [{ role: 'user', content: userMessage }]);
    request.script = completion.text || '';
    request.status = 'generated';
    request.generatedAt = now;
  } catch (err) {
    request.status = 'failed';
    request.error = err.message;
  }
  return request;
}

module.exports = {
  SCRIPT_STATUSES, submitScriptRequest, getScriptRequest, generateScript,
};
