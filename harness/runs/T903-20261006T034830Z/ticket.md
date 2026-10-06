---
title: T903: Scratch passing run
---

## Goal

Harness test only. Create a scratch file so the harness can be exercised end to end.

## Requirements

- None (harness scratch ticket).

## Behaviour

- `scratch/hello.txt` exists and its only line is `hello`.

## Acceptance commands (parsed)

```sh
node -e "const s=require('fs').readFileSync('scratch/hello.txt','utf8').trim(); if (s !== 'hello') { console.error('error: expected hello, got ' + s); process.exit(1) }"
```

## Pending tests to promote

- None

## Protected test changes (parsed)

- None

## Allowed paths (parsed)

- scratch/**

## Out of scope

- Anything outside `scratch/`.

## Notes for the reviewer

- This is a scratch ticket for testing the harness. No product code exists yet.
