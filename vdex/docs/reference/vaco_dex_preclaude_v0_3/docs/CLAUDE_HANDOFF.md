# Claude Code Execution Checklist — Kit 0.2.0

1. Inspect the actual VDEX 0.3.0 repository; do not assume the extracted audit copy is the user's current working tree.
2. Preserve the original baseline and run its tests before changes.
3. Compare these modules against existing domain logic; reuse equivalent code rather than duplicating it.
4. Integrate the property intelligence handler using `INTEGRATION_PATCH.md` or the repository's established routing pattern.
5. Add database migrations for the four new collections/tables. JSON arrays are only a temporary MVP compatibility path.
6. Add authentication and authorization before making endpoints accessible outside local development.
7. Connect candidate generation to actual VACON services only after inspecting their real contracts and credentials.
8. Validate evidence IDs, ownership boundaries, and source provenance server-side.
9. Add audit events for evidence, assessment, highlight, and scenario changes.
10. Run the original suite plus this kit's suite; report results separately and include exact commands.
11. Add integration, E2E, security, and concurrency tests before production deployment.
12. Do not claim live source verification, AI analysis, professional clearance, or external integration unless actually implemented and tested.
