const { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, statSync } = require('fs')
const { dirname, join } = require('path')
const { spawn } = require('child_process')

const rootDir = join(__dirname, '..')
const electronDistDir = join(rootDir, 'node_modules', 'electron', 'dist')
const rceditPath = join(rootDir, 'node_modules', 'electron-winstaller', 'vendor', 'rcedit.exe')
const sourceExePath = join(electronDistDir, 'electron.exe')
const iconPath = join(rootDir, 'assets', 'icon.ico')
const devElectronDir = join(rootDir, '.dev-electron')
const brandedExePath = join(devElectronDir, 'DentalClinic-agorracode-dev-branded.exe')
const stampPath = join(devElectronDir, '.icon-stamp')

function getStamp() {
  const parts = [sourceExePath, iconPath, __filename].map((filePath) => {
    const stat = statSync(filePath)
    return `${filePath}:${stat.size}:${stat.mtimeMs}`
  })

  return parts.join('|')
}

function prepareBrandedElectron() {
  if (!existsSync(sourceExePath)) {
    throw new Error(`Electron executable was not found: ${sourceExePath}`)
  }

  if (!existsSync(rceditPath)) {
    throw new Error(`rcedit was not found: ${rceditPath}`)
  }

  const expectedStamp = getStamp()
  const currentStamp = existsSync(stampPath) ? require('fs').readFileSync(stampPath, 'utf8') : ''

  if (existsSync(brandedExePath) && currentStamp === expectedStamp) {
    return
  }

  rmSync(devElectronDir, { recursive: true, force: true })
  mkdirSync(dirname(brandedExePath), { recursive: true })
  cpSync(electronDistDir, devElectronDir, { recursive: true })
  copyFileSync(join(devElectronDir, 'electron.exe'), brandedExePath)

  require('child_process').execFileSync(rceditPath, [
    brandedExePath,
    '--set-icon',
    iconPath,
    '--set-version-string',
    'FileDescription',
    'DentalClinic - agorracode Dev',
    '--set-version-string',
    'ProductName',
    'DentalClinic - agorracode',
    '--set-version-string',
    'InternalName',
    'DentalClinic-agorracode-dev-branded',
    '--set-version-string',
    'OriginalFilename',
    'DentalClinic-agorracode-dev-branded.exe',
    '--set-version-string',
    'CompanyName',
    'AgorraCode',
  ], { stdio: 'inherit' })

  require('fs').writeFileSync(stampPath, expectedStamp)
}

prepareBrandedElectron()

if (process.argv.includes('--prepare-only')) {
  console.log(`Prepared branded Electron dev executable: ${brandedExePath}`)
  process.exit(0)
}

const child = spawn(brandedExePath, ['.'], {
  cwd: rootDir,
  env: {
    ...process.env,
    NODE_ENV: 'development',
    IS_DEV: 'true',
  },
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
