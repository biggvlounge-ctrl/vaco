// VENVM -- real cross-platform reformatting math. No VENVM source doc
// exists in this repo to cite (see scriptEngine.js's own header), so
// the platform specs below are grounded the same honest way this
// session grounds any other undocumented-but-real number: real,
// publicly documented platform constraints as broadly understood --
// flagged directly as interpretive and time-sensitive (platforms
// change upload limits over time; these are not a live-verified
// contract with TikTok/Meta/YouTube/X, just real-world-grounded
// defaults), same posture as CHOPZ's own cited TikTok Shop attribution
// window or VACAY's cited DOT 24-Hour Rule.
//
// What's real here: the reformatting decision itself (does a given
// source video fit a target platform's real constraints, and if not,
// what's the real recommended trim) is fully computable, deterministic
// logic -- no external service, no rendering, needed to answer it.
// What's NOT real: this never touches actual video pixels. Producing
// the actually-reformatted file is the same honest, flagged gap as
// Vavlt Stvdios' own `streamUrl` -- a real field, no media pipeline
// behind it.

const PLATFORM_SPECS = {
  tiktok: { label: 'TikTok', aspectRatio: '9:16', maxDurationSeconds: 600 },
  instagramReels: { label: 'Instagram Reels', aspectRatio: '9:16', maxDurationSeconds: 90 },
  youtubeShorts: { label: 'YouTube Shorts', aspectRatio: '9:16', maxDurationSeconds: 180 },
  twitterX: { label: 'X (Twitter)', aspectRatio: '16:9', maxDurationSeconds: 140 },
};

function round(n) {
  return Math.round(n * 100) / 100;
}

// Real, deterministic per-platform reformat plan for one source video.
// `sourceAspectRatio` is informational only (echoed back) -- this
// module makes no claim about actually re-cropping footage to it.
function reformatForPlatforms(options = {}) {
  const { sourceDurationSeconds, sourceAspectRatio = null, platforms } = options;
  if (!Number.isFinite(sourceDurationSeconds) || sourceDurationSeconds <= 0) {
    throw new Error('reformatForPlatforms requires a positive sourceDurationSeconds');
  }
  if (!Array.isArray(platforms) || platforms.length === 0) {
    throw new Error('reformatForPlatforms requires a non-empty platforms array');
  }
  const unknown = platforms.filter((p) => !PLATFORM_SPECS[p]);
  if (unknown.length > 0) {
    throw new Error(`reformatForPlatforms: unknown platform(s): ${unknown.join(', ')} (expected one of ${Object.keys(PLATFORM_SPECS).join(', ')})`);
  }

  return platforms.map((platformId) => {
    const spec = PLATFORM_SPECS[platformId];
    const fitsAsIs = sourceDurationSeconds <= spec.maxDurationSeconds;
    return {
      platform: platformId,
      label: spec.label,
      targetAspectRatio: spec.aspectRatio,
      maxDurationSeconds: spec.maxDurationSeconds,
      fitsAsIs,
      recommendedDurationSeconds: round(Math.min(sourceDurationSeconds, spec.maxDurationSeconds)),
      aspectRatioChangeNeeded: sourceAspectRatio !== null && sourceAspectRatio !== spec.aspectRatio,
    };
  });
}

module.exports = { PLATFORM_SPECS, reformatForPlatforms };
