# Dependency remediation report

Audit refreshed on 2026-07-27 with Node 22.23.1 and npm 10.9.8 against the
committed lockfile. No dependency mutation or forced fix was performed.

- Full graph: 24 findings — 1 critical, 19 high, 4 moderate.
- `--omit=dev`: 9 high, 0 critical, 0 moderate.
- The production-filtered graph incorrectly retains Playwright because its
  lockfile package record lacks npm's `dev` marker; `package.json` declares it
  only in `devDependencies`.

Do not run `npm audit fix --force`. The audit's suggested Next/Auth downgrades
are not compatible fixes.

| Package path | Severity | Direct | Scope and reachability | Patched version / action | Breaking risk |
| --- | --- | --- | --- | --- | --- |
| Vitest → Vite/mocker/vite-node | Critical | Yes | Development only. The vulnerable optional Vitest UI server is never started by FanTakes or CI. | Validate Vitest 4.1.10 in a dedicated tooling upgrade PR. | High; major test-runner/Vite change |
| Next.js → bundled PostCSS | High | Yes / transitive | Build/runtime dependency. FanTakes does not accept attacker-controlled CSS or source maps. | No compatible npm-audit fix; npm suggests the unsafe Next 9.3.3 downgrade. Track a patched current-major release. | Critical if downgraded |
| Next.js → sharp/libvips | High | Yes / transitive | Runtime image path. Provider logos use plain `img`; user uploads are not passed to Sharp. | Sharp 0.35+ is patched, but Next controls the bundled version. Track upstream. | High if overridden independently |
| Auth.js → Nodemailer | High | Direct and transitive | Runtime email provider path. FanTakes never exposes Nodemailer's message-level `raw` option to callers. | No available compatible fix. Keep raw/file/URL inputs server-controlled and track Auth.js/Nodemailer. | High if Auth is downgraded |
| Playwright | High | Yes | Development/CI only; browser installer certificate advisory. No runtime bundle exposure. | Upgrade to 1.62 in a dedicated CI/browser batch; local macOS 11 browser compatibility prevents proving it in this sprint. | Medium |
| ESLint → minimatch → brace-expansion | High | Direct/transitive | Development linting only; patterns are repository-controlled. | Validate ESLint 10.8 in a dedicated tooling PR. | High; major ESLint/config change |
| eslint-config-next plugins → minimatch | High | Direct/transitive | Development linting only; no production reachability. | Upgrade with the compatible current Next/ESLint line, not npm's Next 12 suggestion. | High |
| Vite → esbuild | High/moderate | Transitive | Development test server only; not exposed on a network. | Remove the legacy esbuild override while validating Vitest 4. | High |
| tsx → esbuild | Moderate | Yes/transitive | Local scripts and jobs; no public dev server. Current `tsx` is 4.23.1, but the legacy esbuild override keeps the vulnerable transitive version. | Validate removal of the override with the Vitest batch. | Medium |

## Temporary risk acceptance for closed alpha

There is no unexplained Critical or High finding:

- the Critical finding is confined to an unused development UI server;
- development-tool findings are not shipped in the production bundle;
- runtime findings have no compatible patched dependency set reported by npm;
- the vulnerable raw email, attacker-controlled CSS/source-map, and untrusted
  Sharp processing paths are not exposed by FanTakes;
- every runtime finding remains tracked for an upstream-compatible upgrade.

Public beta should require a supported CI upgrade batch for Vitest, Playwright,
ESLint, and the esbuild override, followed by lint, typecheck, unit/integration,
build, and Playwright verification.
