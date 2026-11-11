# VDEX 0.3.0 Integration Patch

This is an additive integration recipe, not a wholesale replacement of `backend/server.js`.

## 1. Add the module

Copy `src/api/property-intelligence.js` to `backend/property-intelligence.js` in the VDEX repository. Because the module imports the highlight generator from `../domain/highlights`, also copy `src/domain/highlights.js` to a repository-root `domain/highlights.js` (or adjust that import to the location where the existing highlight module is installed). Do not copy duplicate logic if an equivalent production module already exists.

At the top of `backend/server.js` add:

```js
const { handlePropertyIntelligence } = require('./property-intelligence');
```

## 2. Extend the fresh database shape

In the existing `fresh()` function add these arrays:

```js
propertyEvidence: [],
propertyHighlights: [],
propertyAssessments: [],
developmentScenarios: []
```

The module also calls `ensureCollections(db)` so existing JSON databases missing these keys are upgraded in memory. The next successful write persists them.

## 3. Mount the handler

Inside the existing `if (url.pathname.startsWith('/api/'))` block, after routes that must retain priority and before the generic API 404, add:

```js
const intelligenceMatch = url.pathname.match(
  /^\/api\/properties\/([^/]+)\/(evidence|highlights|assessments|development-scenarios)$/
);
if (intelligenceMatch) {
  const db = readDb();
  const body = ['POST','PATCH','PUT'].includes(req.method) ? await readBody(req) : {};
  const result = await handlePropertyIntelligence({
    method: req.method,
    pathname: url.pathname,
    body,
    db,
    writeDb
  });
  if (result) return send(res, result.status, result.body);
}
```

Do not mount before authentication once authentication middleware exists. In the current MVP, no production authentication is present; keep these endpoints local or behind a trusted development boundary until authorization is implemented.

## 4. Smoke-test requests

Use a property ID that exists in your disposable database.

```bash
curl -s http://localhost:3000/api/properties/PROPERTY_ID/evidence

curl -s -X POST http://localhost:3000/api/properties/PROPERTY_ID/evidence \
  -H 'Content-Type: application/json' \
  -d '{"statement":"County parcel map retrieved","category":"parcel","sourceName":"County GIS","status":"reported"}'

curl -s -X POST http://localhost:3000/api/properties/PROPERTY_ID/highlights \
  -H 'Content-Type: application/json' \
  -d '{"candidates":[]}'

curl -s http://localhost:3000/api/properties/PROPERTY_ID/highlights
```

Expected: evidence POST returns 201; highlights POST returns exactly three qualified entries, with insufficient-information placeholders when no supported candidates were provided.

## 5. Production changes still required

- Authentication and per-property authorization.
- Transactional PostgreSQL persistence and migrations.
- Schema validation using the project's chosen validation library.
- Rate limiting, request size controls, audit integration, and observability.
- VACON candidate-generation adapter and model evaluation suite.
- External source registry and licensed data adapters.
- Secure image/document storage and malware scanning.
- Review workflows for professional assessments and legal/regulated activities.
