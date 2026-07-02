import { chmodSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertMacOS,
  clientRoot,
  commandExists,
  createMacBuildEnv,
  expandMacArch,
  getServerExecutablePath,
  hasMacServerExecutable,
  normalizeMacArch,
  normalizeReleaseMode,
  printPreflightMessage,
  readCommand,
  resolveElectronBuilderCommand,
  resolveSigningPlan,
  run,
  runElectronBuilder,
  runNpm,
  stagedServerBundlePath,
  toPyInstallerArch
} from './mac-release-utils.mjs'

function parseArgs() {
  const args = process.argv.slice(2)
  const parsed = {
    arch: normalizeMacArch(process.env.DICOM_VISION_MAC_ARCH || 'host'),
    serverBundlePath: process.env.DICOM_VISION_SERVER_BUNDLE_PATH ?? '',
    serverBundlePathByArch: {
      arm64: process.env.DICOM_VISION_SERVER_BUNDLE_PATH_ARM64 ?? '',
      x64: process.env.DICOM_VISION_SERVER_BUNDLE_PATH_X64 ?? ''
    },
    signMode: normalizeReleaseMode(process.env.DICOM_VISION_MAC_SIGN || 'auto'),
    notarizeMode: normalizeReleaseMode(process.env.DICOM_VISION_MAC_NOTARIZE || 'auto'),
    skipBuild: false,
    skipVerify: false
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--server-bundle-path' || arg === '--serverBundlePath') {
      parsed.serverBundlePath = args[index + 1] ?? ''
      index += 1
    } else if (arg === '--server-bundle-path-arm64') {
      parsed.serverBundlePathByArch.arm64 = args[index + 1] ?? ''
      index += 1
    } else if (arg === '--server-bundle-path-x64') {
      parsed.serverBundlePathByArch.x64 = args[index + 1] ?? ''
      index += 1
    } else if (arg === '--arch') {
      parsed.arch = normalizeMacArch(args[index + 1] ?? 'host')
      index += 1
    } else if (arg === '--sign') {
      parsed.signMode = normalizeReleaseMode(args[index + 1] ?? 'auto')
      index += 1
    } else if (arg === '--notarize') {
      parsed.notarizeMode = normalizeReleaseMode(args[index + 1] ?? 'auto')
      index += 1
    } else if (arg === '--skip-build') {
      parsed.skipBuild = true
    } else if (arg === '--skip-verify') {
      parsed.skipVerify = true
    }
  }

  return parsed
}

function assertPackageToolsAvailable({ skipBuild, notarizeMode, signingPlan }) {
  if (!skipBuild) {
    const npmResult = runNpm(['--version'], { capture: true, allowFailure: true })
    if (npmResult.status !== 0) {
      throw new Error('npm was not found. Install Node.js/npm or run this script through npm.')
    }
  }

  if (!commandExists('iconutil')) {
    printPreflightMessage('iconutil was not found; the macOS icon generator will use the built-in ICNS fallback.')
  }
  if (!commandExists('sips')) {
    throw new Error('sips was not found. macOS icon generation requires the system sips tool.')
  }

  const builder = resolveElectronBuilderCommand()
  const builderResult = run(builder.command, [...builder.baseArgs, '--version'], { capture: true, allowFailure: true })
  if (builderResult.status !== 0) {
    throw new Error('electron-builder was not found. Run npm ci before packaging.')
  }

  if (notarizeMode !== 'never' && signingPlan.notarizeEnabled) {
    const notaryTool = readCommand('xcrun', ['notarytool', '--help'])
    if (!notaryTool.ok) {
      throw new Error('xcrun notarytool was not found. Install current Xcode Command Line Tools before notarizing.')
    }
  }
}

function stageServerBundle(bundlePath) {
  if (!bundlePath.trim()) {
    return
  }

  run(process.execPath, [
    resolve(clientRoot, 'scripts', 'stage-server-bundle.mjs'),
    '--bundle-path',
    bundlePath
  ])
}

function ensureServerExecutableReady(arch) {
  if (!existsSync(stagedServerBundlePath) || !hasMacServerExecutable()) {
    throw new Error(
      `macOS server bundle not found: ${stagedServerBundlePath}. Build it first with npm run release:mac or stage it with --server-bundle-path.`
    )
  }

  const executablePath = getServerExecutablePath()
  chmodSync(executablePath, 0o755)

  const fileResult = readCommand('file', [executablePath])
  if (!fileResult.ok) {
    throw new Error(`Failed to inspect backend executable architecture: ${fileResult.stderr}`)
  }

  const output = fileResult.stdout
  const expectedToken = arch === 'x64' ? 'x86_64' : 'arm64'
  if (!output.includes(expectedToken)) {
    throw new Error(
      `Backend executable architecture does not match ${arch}. Expected ${expectedToken}; file reported: ${output}. Rebuild the server with --target-arch ${toPyInstallerArch(arch)}.`
    )
  }
}

function runVerification({ arch, signEnabled, notarizeEnabled }) {
  run(process.execPath, [
    resolve(clientRoot, 'scripts', 'verify-mac-artifact.mjs'),
    '--arch',
    arch,
    '--signed',
    signEnabled ? 'yes' : 'no',
    '--notarized',
    notarizeEnabled ? 'yes' : 'no',
    '--smoke',
    'auto'
  ])
}

const args = parseArgs()
assertMacOS()

const signingPlan = resolveSigningPlan({
  signMode: args.signMode,
  notarizeMode: args.notarizeMode
})
printPreflightMessage(signingPlan.reason)
assertPackageToolsAvailable({
  skipBuild: args.skipBuild,
  notarizeMode: args.notarizeMode,
  signingPlan
})

run(process.execPath, [resolve(clientRoot, 'scripts', 'generate-mac-icon.mjs')])

if (!args.skipBuild) {
  runNpm(['run', 'build'])
}

for (const arch of expandMacArch(args.arch)) {
  const serverBundlePath = args.serverBundlePathByArch[arch] || args.serverBundlePath
  stageServerBundle(serverBundlePath)
  ensureServerExecutableReady(arch)

  const env = createMacBuildEnv({
    signMode: args.signMode,
    notarizeMode: args.notarizeMode,
    signingPlan,
    arch
  })

  runElectronBuilder(['--mac', 'dmg', 'zip', `--${arch}`, '--publish', 'never'], { env })

  if (!args.skipVerify) {
    runVerification({
      arch,
      signEnabled: signingPlan.signEnabled,
      notarizeEnabled: signingPlan.notarizeEnabled
    })
  }
}
