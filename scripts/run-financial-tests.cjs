const { spawnSync } = require('node:child_process')
const args = process.argv.slice(2)
const result = spawnSync(require('electron'), args.length ? args : ['--test', 'tests/payments.test.cjs'], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: 'inherit', windowsHide: true
})
if (result.error) throw result.error
process.exit(result.status ?? 1)
