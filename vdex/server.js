// VDEX -- Vertical Vision Development Exchange.
// Source of truth: README.md, VDEX_MASTER_SPEC.md.
//
// **This is a genuine skeleton, not a stub pretending to be more.**
// The health route reports exactly what exists: no property
// intelligence engine, no data sources wired, no integrations beyond
// what's listed. See VDEX_MASTER_SPEC.md's own implementation-status
// table for what's real and what's still a line in a spec.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8829/api/health

const express = require('express');
const cors = require('cors');
require('dotenv/config');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8829;

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    app: 'vdex',
    home: 19,
    status: 'skeleton -- property intelligence engine, data sources, and integration adapters not yet built',
    seeSpec: 'VDEX_MASTER_SPEC.md',
  });
});

app.listen(PORT, () => {
  console.log(`VDEX listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
