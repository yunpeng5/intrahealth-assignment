# T1-20261006T050512Z notes

Human notes: interventions, corrections, observations.

- **No human intervention** during the maker run. The maker passed all gates on the first
  attempt; the review bot approved in round 1 with 3 nits and no blocking findings.
- **Script location was a ticket constraint, not an agent mistake.** The root task runner is at
  `frontend/scripts/run.mjs` because T1 asked for non-trivial orchestration in a Node script but
  its allowed paths had no root `scripts/` folder. The agent stayed in scope and raised it as an
  open question; the review bot also judged it a constraint. Fix in a later ticket that allows
  `scripts/**` (one-line change in `package.json`).
- **Effective Bash permissions were broader than documented.** The maker ran `ls`, `cat`,
  `find`, `pwd`, `mkdir` and `rm` without denial, although the docs list only `npm`, `npx`,
  `dotnet`, `node`, `git status` and `git diff`; only 4 compound or piped commands were denied.
  Likely cause: the CLI auto-allows read-only commands, and `acceptEdits` auto-approves
  filesystem commands in the working directory. The deterministic gates (scope, protected
  paths, acceptance commands) remained the actual enforcement layer. Harness docs to be
  corrected.
- **Turns metric:** `num_turns` 71 exceeds `maxTurnsPerCall` 60 because the CLI reports roughly
  one turn per tool call (70 tool calls), while `--max-turns` limits model round trips (42 here).
  Not a configuration problem.
