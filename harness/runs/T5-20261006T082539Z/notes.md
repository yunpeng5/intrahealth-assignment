# T5-20261006T082539Z notes

Human notes: interventions, corrections, observations.

- **No human intervention** during the T5 maker run.
- **All gates passed on the first attempt.**
- **The fresh-context review approved with no blocking findings** (two nits: the failure alert
  stays visible after navigating Back; the manual check was an API call through the Vite proxy,
  not a browser walkthrough).
- **Scope held:** front end only; Submit only on the last page, disabled until complete and
  while in flight; one POST of `{ answers }`; answers kept on failure; result shows only the
  label and next steps; no restart, retake, save/resume or section 3 behaviour.
- **Harness gap found:** the maker started `npm run dev:api` and `npm run dev:web` for its live
  check and left both running after the run. The API process locked the back-end build output,
  so a later `npm run verify` failed until the processes were stopped by hand. The harness does
  not clean up background processes the maker starts.
