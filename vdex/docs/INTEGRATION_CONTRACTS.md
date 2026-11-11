# VDEX ecosystem integration contracts

## Purpose
VDEX is an independent application. It calls other Vertical Vision services through versioned, owner-approved contracts; it does not absorb their responsibilities or create substitute identity, wallet, payment, ledger, tokenization or AI-platform systems.

The current runtime exposes `GET /api/integrations` as a readiness inventory. It does not make outbound calls. `config/integrations.env.example` lists the expected configuration keys. Secret values belong in a managed secret vault; VDEX should receive opaque references only.

## Service ownership and permitted handoffs

| Service | VDEX may request/read | System of record / boundary |
|---|---|---|
| VACAY | Authorized listing discovery, seller/owner workflow handoffs, leads, inquiries, viewing requests and transaction handoffs | VACAY owns its marketplace listings and workflows; VDEX remains separate |
| DREAMS Network | Approved project distribution, discovery and referral handoffs | DREAMS owns its distribution and community surfaces; publication requires human approval |
| VULCAN | Approved tokenization request and status | VULCAN owns tokenization and issuance; VDEX does not create tokens or securities offerings |
| VACA | Person and organization verification requests/results | VACA owns identity and verification |
| VASH | Financing referral and permitted status | VASH owns financial products, eligibility and underwriting |
| VCoin | Authorized settlement request/reference and status | VCoin owns balances, ledger and settlement |
| VOKEN | Supported credential/trust references | VOKEN owns supported credential/trust records |
| VACO / VACON | App registration, account context and approved orchestration | VACO/VACON own platform identity context and orchestration |
| VOID | Approved cross-app discovery and service referrals | VOID remains separate; only approved and rights-cleared records are shared |

VEX trading is explicitly outside VDEX.

## Required event envelope for future asynchronous handoffs

Every future outbound event must use a versioned envelope equivalent to:

```json
{
  "eventId": "globally-unique-id",
  "eventType": "vdex.property.inquiry.created",
  "schemaVersion": "1.0",
  "occurredAt": "2026-11-11T00:00:00.000Z",
  "producer": "VDEX",
  "targetService": "VACAY",
  "tenantId": "organization-id",
  "correlationId": "workflow-correlation-id",
  "idempotencyKey": "stable-operation-key",
  "purpose": "specific-authorized-purpose",
  "consentReference": null,
  "approval": { "status": "pending", "approvedBy": null, "approvedAt": null },
  "dataClassification": "confidential",
  "payload": {}
}
```

The example is a schema illustration, not a real event, live API route, provider contract or permission to transmit data. Actual schemas must be negotiated with each service owner.

## Non-negotiable delivery controls

- Obtain service-owner contract, endpoint documentation, sandbox access, approved scopes, credential references, data classification and retention rules before enabling an adapter.
- Authenticate service-to-service calls using the provider-approved mechanism; rotate credentials through a managed vault.
- Enforce tenant scope, least privilege, purpose limitation and consent before creating an event.
- Use an outbox written in the same database transaction as the source change; deliver asynchronously with bounded retries, exponential backoff, dead-letter handling and replay controls.
- Require idempotency keys and provider-side deduplication for mutating requests.
- Sign or otherwise authenticate inbound webhooks; validate timestamps, replay windows and event IDs.
- Record request/response metadata, correlation IDs, actor, approval, delivery status and provider reference without logging secrets or unnecessary personal data.
- Separate `draft`, `pending_approval`, `approved`, `queued`, `delivered`, `failed`, `cancelled` and `reconciled` states. A timeout is not proof of failure; reconcile before retrying a non-idempotent action.
- Human approval remains mandatory for publishing listings, contacting third parties outside existing consent, offers, contracts, financing, tokenization, hiring and money movement.
- Run contract tests against provider sandboxes and end-to-end tests against approved test tenants before production activation.

## Next implementation gate

The next code increment should implement a transactional outbox and event delivery worker only after the production PostgreSQL repository/transaction boundary is available. Do not implement a JSON-file outbox as if it were safe for multi-process delivery. In parallel, obtain the actual VACAY, DREAMS and VULCAN service contracts and sandbox credentials; those three are the primary product workflow connections requested for VDEX.
