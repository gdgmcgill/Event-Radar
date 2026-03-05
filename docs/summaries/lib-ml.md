# lib-ml cleanup summary

**kmeans.ts** — extracted the hardcoded iteration cap (`50`) into a named module-level constant `K_MEANS_MAX_ITERATIONS`. No logic changes.

**dateValidation.ts** — removed an orphaned empty `// Core helpers` section divider that appeared before `// Calendar helpers` with no content between them.

**exportUtils.ts** — removed a `console.warn` debug call from the `downloadExportFile` catch block. The error is still re-thrown.

**classifier.ts**, **classifier-pipeline.ts**, **image-upload.ts** — no changes needed. No console.log calls, no `any` types, no dead code paths, no dead classification categories.
