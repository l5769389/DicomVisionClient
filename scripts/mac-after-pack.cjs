const { existsSync, lstatSync, readdirSync, statSync, chmodSync } = require('node:fs')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit'
  })

  if (result.error) {
    throw result.error
  }
  if (!options.allowFailure && result.status !== 0) {
    const suffix = options.capture && result.stderr ? `\n${result.stderr}` : ''
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}${suffix}`)
  }

  return result
}

function collectFiles(root) {
  const files = []
  if (!existsSync(root)) {
    return files
  }

  for (const entry of readdirSync(root)) {
    const path = join(root, entry)
    const item = lstatSync(path)
    if (item.isSymbolicLink()) {
      continue
    }
    if (item.isDirectory()) {
      files.push(...collectFiles(path))
      continue
    }
    if (item.isFile()) {
      files.push(path)
    }
  }

  return files
}

function isMachOFile(path) {
  const result = run('file', [path], { capture: true, allowFailure: true })
  return result.status === 0 && String(result.stdout).includes('Mach-O')
}

function chmodExecutable(path) {
  const stats = statSync(path)
  chmodSync(path, stats.mode | 0o755)
}

function signMachO(path, identity, entitlementsPath) {
  const args = ['--force', '--timestamp', '--options', 'runtime', '--sign', identity]
  if (entitlementsPath && existsSync(entitlementsPath)) {
    args.push('--entitlements', entitlementsPath)
  }
  args.push(path)
  run('codesign', args)
}

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') {
    return
  }

  const appName = `${context.packager.appInfo.productFilename}.app`
  const appPath = join(context.appOutDir, appName)
  const resourcesPath = join(appPath, 'Contents', 'Resources')
  const serverPath = join(resourcesPath, 'server')
  const serverExecutablePath = join(serverPath, 'DicomVisionServer')

  if (!existsSync(serverExecutablePath)) {
    throw new Error(`Embedded macOS backend executable is missing: ${serverExecutablePath}`)
  }

  chmodExecutable(serverExecutablePath)

  const signMode = process.env.DICOM_VISION_MAC_SIGN_MODE || 'auto'
  const identity = process.env.DICOM_VISION_MAC_SIGN_IDENTITY || process.env.CSC_NAME || ''

  if (signMode === 'never') {
    return
  }

  if (!identity) {
    if (signMode === 'required') {
      throw new Error('macOS signing was required, but no signing identity was provided to afterPack.')
    }
    return
  }

  const entitlementsPath = join(context.packager.projectDir, 'build', 'entitlements.mac.plist')
  const machOFiles = collectFiles(serverPath).filter(isMachOFile)

  for (const filePath of machOFiles) {
    chmodExecutable(filePath)
    signMachO(filePath, identity, entitlementsPath)
  }
}
