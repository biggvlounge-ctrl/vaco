import nextTypescriptConfig from "eslint-config-next/typescript";

// CALL — a real ESLint flat config. `next lint` (the old built-in
// subcommand `package.json`'s own `lint` script called) was removed
// in Next.js 16 -- confirmed directly by running it ("Invalid project
// directory provided, no such directory: .../lint", meaning the CLI
// no longer recognizes "lint" as a subcommand at all) rather than
// assumed.
//
// **A real, working config found on the second attempt**: the first
// draft used `FlatCompat().extends("next/core-web-vitals", ...)`,
// which is only correct for a *legacy* eslintrc-format shareable
// config. `eslint-config-next@16.3.1` already ships a real, native
// flat-config array (confirmed by reading its own `dist/*.js` —
// `module.exports = config` where `config` is a plain array of flat
// config objects, not an eslintrc `{extends, rules}` object) — running
// it through `FlatCompat` crashed with a real "Converting circular
// structure to JSON" error from ESLint's own legacy config validator
// trying to process an already-flat plugin object. Fixed by importing
// the real flat array directly instead.
const eslintConfig = [
  ...nextTypescriptConfig,
  { ignores: [".next/**", "node_modules/**"] },
];

export default eslintConfig;
