> **HISTORICAL PROPOSAL — SUPERSEDED / NOT ACTIVE INSTRUCTIONS**
> The proposed VACO DEX rename is rejected. The active name is VDEX — Vertical Vision Development Exchange. The fundraising concept, if pursued, belongs to the VASH product boundary and must not be merged into VDEX or treated as an implemented integration. See the current VDEX completeness audit.

# Product Rename + VASH Fundraising Extension

## 1. Official product naming

Rename the product and engineering package from **VDEX — Vertical Vision Development Exchange** to **VACO DEX — VACO Development Exchange**. The app remains an independent application. Do not merge it into VACO shell, VASH, VACAY, or VOID. Preserve repository history, identifiers, database records, API compatibility, and existing `vdex` references during migration. Add aliases/deprecation notices where necessary; do not perform destructive global string replacement. Inspect trademarks, domain availability, internal app registry, and naming conflicts before public launch.

## 2. VASH Fundraising

Build **VASH Fundraising** as an application/extension within VASH, not as a standalone competing financial system. It provides campaign creation, fundraising pages, donations, recurring support, peer-to-peer campaigns, team fundraising, event fundraising, matching-gift workflows, campaign updates, donor receipts, supporter management, refunds/disputes workflow, reporting, and social distribution.

### Supported initial campaign types

- Charitable donations (only after beneficiary/organization verification and applicable tax-status disclosure).
- Personal and emergency causes (identity and beneficiary review; fraud/safety escalation).
- Community and nonprofit projects.
- Peer-to-peer and team campaigns.
- Events, ticketing, auctions, and pledge drives (subject to appropriate rules and provider capabilities).
- Reward-based campaigns and product preorders (clear delivery, refund, and consumer disclosures).
- Membership and recurring support.

Do not describe a contribution as tax-deductible unless the recipient and contribution qualify and the platform has verified the relevant status. Do not imply VASH Fundraising itself is a registered charity.

### Distinguish donations from investments

The first release is donation/reward/membership fundraising. Do not offer equity, debt securities, profit-sharing, investment returns, or tokenized investment campaigns through the donation flow. Any securities crowdfunding capability must be a separately approved product and handled through an appropriately registered broker-dealer or SEC-registered funding portal, with legal/compliance approval and the required FINRA membership where applicable. VASH must not assume it may solicit, recommend, arrange, custody, or settle securities.

## 3. Financial architecture

- VASH owns the fundraising product experience, financial orchestration, campaign accounting views, reconciliation interfaces, and approved financial workflows.
- VACA handles identity and organization/beneficiary verification using its actual services.
- VCoin may be used for payment/settlement only where its existing capabilities, authorization, and compliance permit. Do not assume VCoin is a card processor, ACH originator, charitable custodian, or escrow provider.
- Use an approved payment processor/financial partner for card, ACH, wallet, refunds, chargebacks, payouts, and donor receipts as required. No raw card data storage in VASH Fundraising.
- Maintain immutable payment-event references, idempotency keys, ledger entries, campaign balances, payout states, fee disclosures, reconciliation reports, and audit trails.
- Clearly distinguish pledged, authorized, captured, settled, refunded, disputed, reversed, and paid-out amounts.
- No campaign may display funds as received based only on a browser redirect or client-side success state. Require verified server-side payment events/webhooks.

## 4. Social media and VACO ecosystem distribution

Create a shared **VACO Social Distribution Hub** accessible to authorized apps across the VACO ecosystem. VASH Fundraising owns campaign context and share analytics; the shared hub owns reusable account connections, consent, channel adapters, content scheduling, and audit records. Other VACO apps can use the hub only through permissioned integration contracts.

Target channels include Facebook, Instagram, TikTok, YouTube, LinkedIn, X, Threads, Pinterest, Snapchat, WhatsApp, Telegram, Reddit, and email/SMS distribution. This is a target coverage list, not a promise that every provider allows direct API publishing for every account type.

For each provider, support the strongest permitted capability:
1. Native authorized publishing API, only after provider app approval and user OAuth consent.
2. Official share intent/deep link or platform share sheet.
3. Copy campaign URL and prewritten message for manual sharing.
4. Downloadable campaign media pack where direct integration is unavailable.

Never scrape private accounts, collect passwords, bypass platform restrictions, or auto-post without explicit authorization. Respect each platform's API scopes, content rules, rate limits, review/audit requirements, user confirmation, and account eligibility. Store OAuth tokens encrypted and scoped; support disconnect/revoke and token expiry. Do not promise universal cross-posting.

### Social features

- One campaign share link with attribution parameters and referral codes.
- Platform-specific copy, image, vertical video, story/reel, and caption variants.
- Campaign QR codes and printable flyers.
- Scheduled posts where supported and approved.
- User-reviewed AI-generated captions, translations, and creative assets.
- Peer-to-peer supporter pages and team links.
- Campaign progress cards and approved milestone updates.
- Referral and conversion analytics using consented/available data.
- Share history, delivery state, API errors, and retry controls.
- UTM/referral attribution without exposing donor private data.
- Optional cross-app campaign promotion across VACO apps with campaign-owner consent and admin policy.

### Provider capability model

Each provider adapter must declare supported capabilities independently: `share_link`, `oauth_connect`, `publish_text`, `publish_image`, `publish_video`, `publish_story`, `schedule_post`, `read_aggregate_analytics`, `webhook_events`. Capability must be verified against current official provider documentation and actual app approval. Unsupported capabilities must be disabled, not simulated.

## 5. VACO ecosystem connections

- VACO shell: app discovery, navigation, account context, notifications, and shared permissions.
- VACON: campaign assistant, fundraising copy suggestions, fraud/risk triage, campaign insights, supporter Q&A, and workflow orchestration. AI output requires human review before public posting or material financial decisions.
- VACA: individual, organization, nonprofit, and beneficiary verification.
- VASH: campaign financial workspace, payout and reconciliation workflows, approved payment partner integrations.
- VCoin: only approved payment/settlement rails where supported.
- VVNP: nonprofit/philanthropic program discovery and approved campaign routing; do not assume every fundraiser is a VVNP beneficiary.
- VOID: optional community service, volunteer, and in-kind support workflows where appropriate.
- VACO DEX: optional property/community development campaigns and project funding pages; do not imply donations create property ownership or investment rights.
- Other VACO apps: authorized discovery, campaign promotion, event, commerce, and community distribution integrations.

## 6. Competitive research baseline

Use these platforms as reference competitors and feature benchmarks, not as templates to copy:

- GoFundMe: personal causes and broad crowdfunding.
- Givebutter: all-in-one nonprofit campaigns, peer-to-peer, events, auctions, CRM, and communications.
- Donorbox: donation forms, recurring donations, donor management, and peer-to-peer.
- Classy / GoFundMe Pro: nonprofit digital campaigns and peer-to-peer fundraising.
- Fundraise Up: optimized donation experiences and peer-to-peer features.
- Funraise: nonprofit fundraising and CRM.
- Zeffy: nonprofit fundraising with a donor-supported pricing model.
- DonorDrive / Bonterra: peer-to-peer and event fundraising.
- OneCause: event fundraising and mobile bidding.
- Qgiv: nonprofit forms, events, and peer-to-peer tools.
- PledgeIt: pledge and challenge-based fundraising.
- Kickstarter / Indiegogo: reward/preorder and project crowdfunding (different from charitable donation models).
- DonorsChoose: education-project funding model.
- Give Lively: nonprofit donation and peer-to-peer tools.

Competitive feature categories to benchmark: campaign setup, identity/beneficiary verification, donor checkout, recurring gifts, peer-to-peer, team pages, events, auctions, text-to-give, donor CRM, matching gifts, receipts, refunds, fraud controls, social sharing, campaign analytics, API access, fees, payout timing, and mobile usability. Verify current vendor terms and pricing before procurement or comparison claims.

## 7. Initial data contracts

Campaign: `id`, `ownerId`, `beneficiaryId`, `type`, `title`, `description`, `goalCents`, `raisedCents`, `currency`, `fundingModel`, `state`, `verificationState`, `disclosureVersion`, `createdAt`, `updatedAt`, `version`.

Contribution: `id`, `campaignId`, `supporterId` (nullable/anonymous policy), `amountCents`, `currency`, `paymentProvider`, `providerPaymentId`, `paymentStatus`, `feeCents`, `netCents`, `refundStatus`, `createdAt`.

SocialConnection: `id`, `ownerId`, `provider`, `providerAccountId`, `scopes`, `encryptedTokenReference`, `expiresAt`, `connectionStatus`, `consentedAt`, `revokedAt`.

SocialPublication: `id`, `campaignId`, `provider`, `connectionId`, `contentVersion`, `mediaIds`, `publicationStatus`, `providerPostId`, `scheduledAt`, `publishedAt`, `errorCode`, `createdBy`.

Attribution: `id`, `campaignId`, `channel`, `referralCode`, `shareId`, `clickCount`, `conversionCount`, `attributedAmountCents`, `measurementMethod`, `updatedAt`.

## 8. Required security, fraud, and compliance controls

- Identity and beneficiary verification proportionate to campaign risk.
- Organization authority and nonprofit-status checks where claimed.
- Prohibited-campaign and restricted-goods policy review.
- Fraud reports, moderation queue, escalation, holds, and appeals.
- Sanctions/AML/KYC checks where required by financial partners and applicable law.
- Age, consent, privacy, and sensitive-cause protections.
- Donation receipt and tax language controls.
- Refund, dispute, chargeback, cancellation, and payout workflows.
- Campaign owner and beneficiary transparency.
- Fee disclosure before contribution.
- Data minimization, retention, access logs, and deletion workflows.
- No public exposure of donor contact details or sensitive beneficiary information by default.

## 9. Required acceptance tests

1. Create a draft donation campaign.
2. Block activation until required beneficiary verification is complete.
3. Reject unsupported investment/securities campaign types.
4. Require fulfillment disclosure for rewards/preorders.
5. Record a contribution only after a verified server-side payment event.
6. Prevent duplicate webhook processing with idempotency.
7. Distinguish gross, fees, net, refunds, disputes, and payouts.
8. Prevent campaign owner from editing settled payment records.
9. Connect/disconnect a social account using approved OAuth scopes.
10. Reject expired/revoked social tokens and surface reconnect status.
11. Generate a share link for every campaign.
12. Use manual share fallback when a provider API is unavailable.
13. Require user consent before publishing content.
14. Respect provider-specific capabilities and rate limits.
15. Preserve campaign attribution across approved VACO app referrals.
16. Ensure one VACO app cannot access another app's private social tokens.
17. Prevent AI from publishing unreviewed fundraising claims.
18. Ensure donor private information is not embedded in share URLs or public analytics.
19. Verify campaign receipts and transaction reconciliation.
20. Verify fraud holds prevent payout until resolved.

## 10. Claude Code implementation directive

Update every user-facing name, package metadata, documentation, environment variable examples, UI labels, tests, and app registry references from VDEX to VACO DEX where appropriate. Preserve legacy IDs, migration compatibility, and repository history. Do not destructively rename existing production data.

Add VASH Fundraising as a VASH extension and implement it as a first-class application module with shared VACO Social Distribution Hub contracts. Reuse VASH/VACA/VCoin/VACON and existing platform services. Do not invent endpoints or claim integrations are live until credentials, scopes, and end-to-end tests confirm them.

Implement donation/reward/membership workflows first. Keep securities crowdfunding out of scope unless separately approved with specialist legal review and an appropriately registered intermediary. Run all tests, report actual results, and list all external provider approvals and credentials still required.
