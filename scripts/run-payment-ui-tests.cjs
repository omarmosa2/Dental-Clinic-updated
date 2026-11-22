const {spawnSync}=require('node:child_process')
const env={...process.env}
delete env.ELECTRON_RUN_AS_NODE
const result=spawnSync(require('electron'),['tests/payment-ui.electron.cjs'],{env,stdio:'inherit',windowsHide:true})
if(result.error)throw result.error
process.exit(result.status ?? 1)
