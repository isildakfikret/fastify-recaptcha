# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`fastify-recaptcha` is a small Fastify v5 plugin (published to npm) that verifies Google reCAPTCHA v2/v3 tokens on every request. Package manager is pnpm.

## Tooling migration in progress

The toolchain is being moved from eslint/prettier/jest/preconstruct/standard-version to oxlint/oxfmt/vitest/swc/changesets. The migration is incomplete, so some `package.json` scripts still call tools that are no longer installed:

- `pnpm typecheck` (`tsc --noEmit`, covers `src`, `test` and the vitest config), `pnpm lint` (`oxlint --type-aware`, config `.oxlintrc.json`) and `pnpm format` / `pnpm format:check` (`oxfmt`, config `.oxfmtrc.json`: single quotes, trailing commas, 128-col width) work.
- `pnpm build` is done with swc and produces `dist/cjs` (CommonJS, `.swcrc.cjs.json`), `dist/esm` (ESM with fully resolved `.js` import specifiers, `.swcrc.esm.json`) and `dist/types` (declarations via `tsc -p tsconfig.build.json`). `build:meta` writes a `package.json` with the right `type` into `dist/cjs` and `dist/esm`. `pnpm watch` rebuilds only the CJS output, and `dev` was removed (it was `preconstruct dev`). `package.json` points `main`/`module`/`types`/`exports` at these outputs, and `example/demo-server.cjs` loads `../dist/cjs/index.js`.
- Tests run on vitest (`vitest.config.mts`: `test/**/*.spec.ts`, node environment, v8 coverage). `pnpm test`, `pnpm test:watch` and `pnpm test:cov` work. Mocks use `vi.*` with explicit imports from `vitest`, not globals.
- Releases use changesets: `pnpm changeset` records a change, `changeset:version` / `changeset:publish` are run by `.github/workflows/release.yml` (needs the `NPM_TOKEN` repo secret). `ci.yml` runs lint, format check, build and tests (Node 20/22/24). `standard-version` and the `release:*` scripts were removed, but the package is still in devDependencies.

When you change any of these, update the scripts, configs and this section together. Run a single test with `pnpm vitest run test/plugin.spec.ts -t "<test name>"`.

## Architecture

- `src/index.ts` wraps `pluginCallback` in `fastify-plugin` (`fp`) so its hooks apply to the parent scope rather than staying encapsulated. It exports the plugin as both a named (`fastifyRecaptcha`) and a default export, along with the options types and an `errors` namespace.
- `src/lib/plugin-callback.ts` holds all the runtime behavior:
  - It rejects a second registration by checking a private `Symbol` decorator, and it rejects an empty `secretKey`.
  - It merges user options over `defaultOptions` from `src/contracts/plugin-options.ts`.
  - It registers a global `onRequest` hook that reads the token from the **`x-recaptcha-response` header** (not the body) and calls `RecaptchaHttpClient.verify`.
  - A route opts out with `config: { recaptcha: false }`. The module augmentation of `FastifyContextConfig` lives in this file.
  - When verification fails, the hook throws a `RecaptchaPluginError` subclass. The hook catches it, passes it to the user's `err(err)` formatter, and sends the result with `err.status`. Any other error is rethrown.
- `src/lib/recaptcha-http-client.ts` POSTs form-encoded data to Google's `siteverify` endpoint using the global `fetch` (Node ≥20). A non-2xx response throws `RecaptchaVerificationInvalidError`, and `success: false` throws `RecaptchaVerificationFailedError` (403). Score and action are not checked yet.
- `src/errors/` contains `RecaptchaPluginError` (base class, which carries `status`) and its subclasses. To add a new error case, subclass the base class and choose a status code; the hook already turns any subclass into a response.

## Tests

`test/plugin.spec.ts` builds a real Fastify instance and sends requests to it with `supertest`. It mocks the whole `src/lib/recaptcha-http-client` module, so tests never call Google. The secret key used there is Google's public test key.
