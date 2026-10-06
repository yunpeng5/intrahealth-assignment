// Root task runner for `npm run setup`, `npm run verify` and `npm run verify:pending`.
// Runs each step as a child process (no shell) so it behaves the same on Windows and POSIX,
// and passes exit codes through. See docs/architecture.md.
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const solution = 'backend/PulseCheck.slnx'

// Prefer the npm CLI that launched us (npm sets npm_execpath), so no `npm.cmd` shell shim is needed.
function npm(...args) {
  const npmCli = process.env.npm_execpath
  if (npmCli && npmCli.endsWith('.js')) {
    return [process.execPath, npmCli, '--prefix', 'frontend', ...args]
  }
  return ['npm', '--prefix', 'frontend', ...args]
}

const modes = {
  setup: {
    gate: true,
    steps: [
      ['front end: install dependencies', npm('ci')],
      ['back end: restore', ['dotnet', 'restore', solution]],
    ],
  },
  verify: {
    gate: true,
    steps: [
      ['back end: format check', ['dotnet', 'format', solution, '--verify-no-changes']],
      ['back end: build', ['dotnet', 'build', solution, '--nologo']],
      ['back end: tests', ['dotnet', 'test', solution, '--no-build', '--nologo', '--filter', 'Category!=Pending']],
      ['front end: lint', npm('run', 'lint')],
      ['front end: typecheck', npm('run', 'typecheck')],
      ['front end: tests', npm('test')],
    ],
  },
  // Pending tests describe behaviour not built yet (D-12): report the results, never gate on them.
  pending: {
    gate: false,
    steps: [
      ['back end: pending tests', ['dotnet', 'test', solution, '--nologo', '--filter', 'Category=Pending']],
      ['front end: pending tests', npm('run', 'test:pending')],
    ],
  },
}

function run([command, ...args]) {
  // Only the `npm` fallback needs a shell on Windows (npm.cmd); its arguments contain no shell syntax.
  const shell = process.platform === 'win32' && command === 'npm'
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell })
  if (result.error) {
    console.error(`Could not start "${command}": ${result.error.message}`)
    return 1
  }
  return result.status ?? 1
}

const modeName = process.argv[2]
const mode = modes[modeName]
if (!mode) {
  console.error(`Usage: node frontend/scripts/run.mjs <${Object.keys(modes).join('|')}>`)
  process.exit(2)
}

const results = []
for (const [name, command] of mode.steps) {
  console.log(`\n=== ${modeName}: ${name} ===`)
  const code = run(command)
  results.push([name, code])
  if (code !== 0 && mode.gate) {
    console.error(`\n${modeName} FAILED at step "${name}" (exit code ${code}).`)
    process.exit(code)
  }
}

console.log(`\n=== ${modeName}: summary ===`)
for (const [name, code] of results) {
  console.log(`${code === 0 ? 'PASS' : 'FAIL'}  ${name}${code === 0 ? '' : ` (exit code ${code})`}`)
}
if (!mode.gate && results.some(([, code]) => code !== 0)) {
  console.log('Failing pending tests are expected until their ticket is done; this run is not a gate.')
}
