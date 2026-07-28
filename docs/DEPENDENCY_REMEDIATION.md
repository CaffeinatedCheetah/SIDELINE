# Dependency remediation report

Do not run `npm audit fix --force`.

The last repository-verified audit recorded 15 findings (4 moderate, 10 high,
1 critical) and 9 production-only high findings. The sprint input references a
newer 24-finding audit; that count must be regenerated in the supported CI
Node/npm environment before dependency status can be promoted to PASS. The
temporary Node distribution on this macOS 11 workstation has a broken npm
launcher, so no newer count is claimed.

| Package path | Severity | Scope | Risk | Compatible action |
| --- | --- | --- | --- | --- |
| Auth.js → Nodemailer | High | Runtime | Email raw-message advisory; FanTakes does not accept caller-controlled raw options | Track Auth.js compatibility with patched Nodemailer major; do not force |
| Next.js → PostCSS/sharp | High | Runtime/build | Transitive bundled paths; no caller-controlled CSS source maps or image-processing input | Upgrade Next.js in a controlled batch when upstream ships compatible fixes |
| Vitest → esbuild | Critical in last audit | Development only | Test/dev server exposure, not production bundle | Upgrade Vitest/esbuild in supported CI and rerun the full suite |
| Playwright | High in last audit | Development only | Local browser-test tooling | Upgrade in CI on macOS 12+/Linux; local pin is required by macOS 11 |
| Prisma | Previously patched | Runtime/build | ORM/client path | Keep Prisma and generated client pinned together |

Priority remains production runtime, authentication/server dependencies,
build-pipeline exposure, then development-only tools. Every upgrade batch must
run lint, typecheck, unit/integration tests, build, and Playwright. Temporary
acceptance is limited to unreachable development-only paths and documented
upstream-compatible blockers.
