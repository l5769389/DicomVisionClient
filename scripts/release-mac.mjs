import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertMacOS,
  clientRoot,
  commandExists,
  expandMacArch,
  normalizeMacArch,
  normalizeReleaseMode,
  printPreflightMessage,
  readCommand,
  resolveSigningPlan,
  run,
  toPyInstallerArch
} from './mac-release-utils.mjs'

const defaultServerRepoPath = resolve(clientRoot, '..', 'DicomVisionServer')

function parseArgs() {
  const args = process.argv.slice(2)
  const parsed = {
    serverRepoPath: defaultServerRepoPath,
    serverOutputRoot: '',
    bundleName: 'DicomVisionServer',
    arch: normalizeMacArch(process.env.DICOM_VISION_MAC_ARCH || 'host'),
    signMode: normalizeReleaseMode(process.env.DICOM_VISION_MAC_SIGN || 'auto'),
    notarizeMode: normalizeReleaseMode(process.env.DICOM_VISION_MAC_NOTARIZE || 'auto'),
    skipVerify: false
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--server-repo-path' || arg === '--serverRepoPath') {
      parsed.serverRepoPath = resolve(args[index + 1] ?? '')
      index += 1
    } else if (arg === '--server-output-root' || arg === '--serverOutputRoot') {
      parsed.serverOutputRoot = resolve(args[index + 1] ?? '')
      index += 1
    } else if (arg === '--bundle-name' || arg === '--bundleName') {
      parsed.bundleName = args[index + 1] ?? parsed.bundleName
      index += 1
    } else if (arg === '--target-arch' || arg === '--targetArch' || arg === '--arch') {
      parsed.arch = normalizeMacArch(args[index + 1] ?? 'host')
      index += 1
    } else if (arg === '--sign') {
      parsed.signMode = normalizeReleaseMode(args[index + 1] ?? 'auto')
      index += 1
    } else if (arg === '--notarize') {
      parsed.notarizeMode = normalizeReleaseMode(args[index + 1] ?? 'auto')
      index += 1
    } else if (arg === '--skip-verify') {
      parsed.skipVerify = true
    }
  }

  return parsed
}

function assertPythonReady(pythonCommand, serverRepoPath) {
  const versionResult = readCommand(pythonCommand, ['--version'], { cwd: serverRepoPath })
  if (!versionResult.ok) {
    throw new Error(`Python was not found. Set PYTHON to a Python 3.13 executable. ${versionResult.stderr}`)
  }

  const versionOutput = `${versionResult.stdout} ${versionResult.stderr}`
  const match = versionOutput.match(/Python\s+(\d+)\.(\d+)/)
  if (!match || match[1] !== '3' || match[2] !== '13') {
    throw new Error(`DicomVisionServer requires Python 3.13. Detected: ${versionOutput.trim()}`)
  }

  const pyInstallerResult = readCommand(
    pythonCommand,
    ['-c', 'import importlib.util; raise SystemExit(0 if importlib.util.find_spec("PyInstaller") else 1)'],
    { cwd: serverRepoPath }
  )
  const venvPythonPath = resolve(
    serverRepoPath,
    '.venv',
    process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'
  )
  const venvPyInstallerResult = existsSync(venvPythonPath)
    ? readCommand(
        venvPythonPath,
        ['-c', 'import importlib.util; raise SystemExit(0 if importlib.util.find_spec("PyInstaller") else 1)'],
        { cwd: serverRepoPath }
      )
    : { ok: false }
  const uvAvailable = commandExists('uv')
  if (!uvAvailable && !pyInstallerResult.ok && !venvPyInstallerResult.ok) {
    throw new Error(
      'Neither uv nor PyInstaller was found. Install uv or install PyInstaller in the server Python environment before building the desktop backend bundle.'
    )
  }
}

function assertReleaseToolsReady({ pythonCommand, serverRepoPath, signingPlan, notarizeMode }) {
  assertPythonReady(pythonCommand, serverRepoPath)

  if (!commandExists('file')) {
    throw new Error('The file command was not found. macOS packaging uses it to validate backend architecture.')
  }

  if (notarizeMode !== 'never' && signingPlan.notarizeEnabled) {
    const notaryTool = readCommand('xcrun', ['notarytool', '--help'])
    if (!notaryTool.ok) {
      throw new Error('xcrun notarytool was not found. Install current Xcode Command Line Tools before notarizing.')
    }
  }
}

function resolveArchOutputRoot(baseOutputRoot, arch) {
  return resolve(baseOutputRoot, `macos-${arch}`)
}

function buildServerBundle({ arch, args, serverRepoPath, serverBuildScript, serverOutputRoot, pythonCommand }) {
  const archOutputRoot = resolveArchOutputRoot(serverOutputRoot, arch)
  const serverBundlePath = resolve(archOutputRoot, args.bundleName)
  const serverExecutablePath = resolve(serverBundlePath, args.bundleName)
  const serverBuildArgs = [
    serverBuildScript,
    '--output-root',
    archOutputRoot,
    '--bundle-name',
    args.bundleName,
    '--target-arch',
    toPyInstallerArch(arch)
  ]

  run(pythonCommand, serverBuildArgs, { cwd: serverRepoPath })

  if (!existsSync(serverExecutablePath)) {
    throw new Error(`Built server bundle is missing expected executable: ${serverExecutablePath}`)
  }

  return serverBundlePath
}

const args = parseArgs()
assertMacOS()

const signingPlan = resolveSigningPlan({
  signMode: args.signMode,
  notarizeMode: args.notarizeMode
})
printPreflightMessage(signingPlan.reason)

const serverRepoPath = resolve(args.serverRepoPath)
const serverOutputRoot = args.serverOutputRoot || resolve(serverRepoPath, 'dist')
const serverBuildScript = resolve(serverRepoPath, 'scripts', 'build_desktop_bundle.py')
const pythonCommand = process.env.PYTHON || 'python3'

if (!existsSync(serverBuildScript)) {
  throw new Error(`Server build script not found: ${serverBuildScript}`)
}

assertReleaseToolsReady({
  pythonCommand,
  serverRepoPath,
  signingPlan,
  notarizeMode: args.notarizeMode
})

const targetArchs = expandMacArch(args.arch)

for (const arch of targetArchs) {
  const serverBundlePath = buildServerBundle({
    arch,
    args,
    serverRepoPath,
    serverBuildScript,
    serverOutputRoot,
    pythonCommand
  })

  const packageArgs = [
    resolve(clientRoot, 'scripts', 'package-mac.mjs'),
    '--arch',
    arch,
    '--sign',
    args.signMode,
    '--notarize',
    args.notarizeMode,
    '--server-bundle-path',
    serverBundlePath
  ]

  if (args.skipVerify) {
    packageArgs.push('--skip-verify')
  }

  run(process.execPath, packageArgs)
}
