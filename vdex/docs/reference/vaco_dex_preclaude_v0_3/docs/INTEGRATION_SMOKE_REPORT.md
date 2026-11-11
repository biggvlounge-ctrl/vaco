# Integration Smoke Report — VDEX 0.3.0 Disposable Copy

Date: 2026-11-08

A disposable copy of the extracted VDEX 0.3.0 baseline was used. The original archive was not modified. The new handler and highlight module were added to the disposable copy, and a separate temporary JSON database was used.

| Operation | Result |
|---|---|
| Start existing VDEX HTTP server | PASS |
| Create test property through existing API | HTTP 201 |
| Create property evidence through new route | HTTP 201 |
| Generate highlights through new route | HTTP 201 |
| Return exactly three highlights with insufficient evidence | PASS |

The highlight test intentionally supplied no candidate findings. The API correctly returned three explicit `insufficient_information` entries rather than inventing property facts.

This is a local integration smoke test of the new handler in a disposable copy. It does not establish production security, concurrent-write safety, external integrations, AI model quality, or deployment readiness.
