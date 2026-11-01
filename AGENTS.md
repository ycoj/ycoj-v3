# Repository Instructions

## Repository layout

This Git repository contains the Hydro-based backend at the root and the Next.js frontend in `ycoj-ui/`. Both applications have independent dependencies, builds, and production processes. Run backend commands from the root and frontend commands from `ycoj-ui/`.

Before changing frontend code, read `ycoj-ui/AGENTS.md` and its required code-style skill. For frontend API contracts, inspect the backend implementation when the response shape is unclear.

When a user asks you to modify the frontend in the current code, default to the new `ycoj-ui/`. There is no need to modify Hydro's legacy UI.

## Track Hydro upstream merges

- Keep a tracked file named `HYDRO_COMMIT` at the repository root. It must contain exactly one full 40-character upstream Hydro commit SHA followed by a newline.
- Every merge or full synchronization from `https://github.com/hydro-dev/Hydro` must update `HYDRO_COMMIT` in the same change to the upstream commit actually integrated.
- The marker records the integrated upstream baseline, not the latest commit fetched or reviewed. Do not advance it for an inspection, a partial cherry-pick, or an ancestry-only merge that leaves upstream changes unintegrated.
- Before advancing the marker, verify that the commit exists in Hydro's upstream history and that its changes through that baseline have been integrated, accounting for intentional YCOJ adaptations. Record any intentionally omitted changes in the merge description.
- When importing upstream backend API changes, also follow the API documentation synchronization requirements below.

## Keep backend API documentation synchronized

Any backend change that adds, removes, renames, or changes an HTTP route, connection endpoint, `/api/:op` operation, request parameter or validation rule, permission requirement, response schema, status behavior, content type, redirect, or side effect must update `.agents/skills/ycoj-api/` in the same change.

- Update the matching endpoint document and API index; add a document in the URL-appropriate group for a new endpoint.
- Keep each affected contract's description, request type and example, and response type and example aligned with the implementation.
- Update any common workflow whose request sequence, fields, responses, verification, or stopping conditions are affected.
- Do not consider the backend change complete until the synchronized documentation is validated and contains no stale route or operation references.
