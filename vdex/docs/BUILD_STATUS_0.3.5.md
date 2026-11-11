# VDEX Build Status — 0.3.5

## Completed this increment
- Added job-specific worker application submission for open VDEX jobs, including a frontend apply form on each open assignment.
- Required applicant name, one contact channel, and explicit job-specific consent.
- Captured skills, experience, availability, optional HTTPS portfolio, and self-reported credentials; credentials remain unverified.
- Prevented duplicate active applications per job/contact.
- Kept application records and contact details out of public job listing responses.
- Added one-time-token application withdrawal, contact prohibition, local applicant identity/contact/profile-field erasure, and audit event.
- Withheld employer review APIs until authentication and organization-level authorization exist.
- No automated hiring, credential approval, assignment award, or payment.

## Verification
`npm run check`: PASS.
`npm test`: PASS, 30 tests, 0 failures.

## Important limits
- Local JSON persistence remains single-process/demo only.
- Applicant contact information is stored in local JSON until withdrawal; do not expose this API publicly without authentication, encryption, access controls, retention policy, and security review.
- Self-reported credentials are not verified.
- No employment classification, licensing, insurance, background-check, or worker eligibility determination is made.

## Verification details
- `npm run check`: PASS.
- `npm test`: PASS, 30 tests, 0 failures.
- Regression coverage includes consent requirement, successful application, duplicate active application rejection, invalid withdrawal token, successful withdrawal, repeated withdrawal rejection, and confirmation that applicant profile/contact fields are erased after withdrawal.
