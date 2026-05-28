Title: Audit & Refactor — Array Filtering Helper Libraries

Summary
-------
I audited the repository for usages of heavy helper utility libraries (lodash, underscore, ramda, lodash-es) that are commonly pulled in just to perform simple array filtering/mapping. The goal was to replace those usages with native ECMAScript APIs where appropriate to reduce bundle size and code bloat.

What I did
-----------
- Searched the `src/` tree for imports/usages of `lodash`, `lodash-es`, `underscore`, and `ramda`, and for patterns like `_.filter`, `_.find`, or `import { filter } from`.
- Reviewed `package.json` for direct dependencies referencing these utilities.

Findings
--------
- No occurrences found in the `src/` files — there are no direct imports or calls to `_.filter`, `_.find`, or named `filter` imports from these libraries.
- `package.json` does not declare `lodash`, `underscore`, or `ramda` as direct dependencies.
- Some lodash-related packages appear transitively under `node_modules` (e.g. `lodash.merge`, `lodash.debounce`) as part of toolchains or other packages, which is expected.

Conclusion / Fix
----------------
No source-file refactor was required because the codebase already uses native JS/React mechanisms for filtering and mapping. The "fix" is to document these findings and recommend dependency/bundle hygiene steps to avoid accidentally adding heavy helper suites in the future.

Recommended follow-ups
----------------------
- Run dependency and bundle analysis (`npm ls lodash*`, `npm dedupe`, or a bundler analyzer) to identify which transitive packages pull in lodash variants.
- If desired, replace direct usages of heavy helpers in the future with native methods: `Array.prototype.filter`, `map`, `reduce`, `Set` for uniqueness, and `Object.entries`/`Object.fromEntries` for object transformations.
- Add a lightweight linter rule or code review checklist item to prevent adding full `lodash`/`underscore` for small utilities.

Commands to reproduce the audit locally
-------------------------------------
```bash
# search for occurrences
rg "lodash|lodash-es|underscore|ramda|_\.filter|_\.find|import \{ filter \}" src || true

# list transitive lodash-related packages
npm ls lodash lodash.merge lodash.debounce || true

# run build to confirm nothing breaks
npm install && npm run build
```

If you'd like, I can follow up by running a transitive dependency cleanup and opening a PR to remove or replace specific direct dependencies that are unused.

Files touched
------------
- Added this PR documentation: `docs/PR_Filtering_Refactor.md`

