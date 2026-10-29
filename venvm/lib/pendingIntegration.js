// VENVM -- the one shared, honest stub every dashboard module below
// reaches for on its generative sliver: copywriting, image, video,
// voice, translation, SEO, social, email, SMS, or push generation.
// Checked directly (grep across this whole repo): no OpenAI/
// Replicate/ElevenLabs/etc API key is configured anywhere in this
// environment -- the same real absence `growthPrograms.js` and
// `VENVM_MARKETING_DTC_CAPABILITIES.md` already confirmed for "AI
// growth recommendations" and the Photo-Grounded Scene Generation
// pipeline.
//
// Every dashboard module's generative half calls this ONE function
// rather than inventing its own ad-hoc "not implemented" error, so
// the failure is consistent and honestly labeled everywhere -- the
// same posture `scriptEngine.js` already takes for a real completion
// failure: marked `failed` with the real reason attached, never a
// fabricated result standing in for a real one.

class PendingIntegrationError extends Error {}

function pendingGenerationCall(feature) {
  throw new PendingIntegrationError(
    `${feature} requires a generation API key that is not configured in `
    + 'this environment -- this is a clearly-labeled pending integration '
    + 'point, not a fabricated result.',
  );
}

module.exports = { pendingGenerationCall, PendingIntegrationError };
