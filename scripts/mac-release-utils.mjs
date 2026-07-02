import { spawnSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

export const __dirname = dirname(fileURLToPath(import.meta.url))
export const clientRoot = resolve(__dirname, '..')
export const outputRoot = resolve(clientRoot, 'dist-electron')
export const stagedServerBundlePath = resolve(clientRoot, 'dist-server', 'DicomVisionServer')
export const macArchChoices = new Set(['host', 'arm64', 'x64', 'all'])
export const releaseModeChoices = new Set(['auto', 'never', 'required'])

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? clientRoot,
    env: options.env ?? process.env,
    encoding: options.encoding ?? 'utf8',
    timeout: options.timeoutMs,
    stdio: options.capture ? 'pipe' : 'inherit',
    shell: process.platform === 'win32'
  })

  if (result.error) {
    if (options.allowFailure) {
      return {
        ...result,
        status: 1,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? result.error.message
      }
    }
    throw result.error
  }
  if (!options.allowFailure && result.status !== 0) {
    const suffix = options.capture && result.stderr ? `\n${result.stderr}` : ''
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}${suffix}`)
  }

  return result
}

export function commandExists(command) {
  return run('which', [command], { capture: true, allowFailure: true }).status === 0
}

export function normalizeReleaseMode(value, defaultValue = 'auto') {
  const mode = (value || defaultValue).trim().toLowerCase()
  if (!releaseModeChoices.has(mode)) {
    throw new Error(`Invalid release mode: ${value}. Expected auto, never, or required.`)
  }
  return mode
}

export function normalizeMacArch(value = 'host') {
  const arch = value.trim().toLowerCase()
  if (arch === 'x86_64') {
    return 'x64'
  }
  if (!macArchChoices.has(arch)) {
    throw new Error(`Invalid macOS arch: ${value}. Expected host, arm64, x64, or all.`)
  }
  return arch
}

export function getHostMacArch() {
  return process.arch === 'arm64' ? 'arm64' : 'x64'
}

export function expandMacArch(value = 'host') {
  const arch = normalizeMacArch(value)
  if (arch === 'all') {
    return ['arm64', 'x64']
  }
  if (arch === 'host') {
    return [getHostMacArch()]
  }
  return [arch]
}

export function toPyInstallerArch(arch) {
  return arch === 'x64' ? 'x86_64' : arch
}

export function assertMacOS() {
  if (process.platform !== 'darwin') {
    throw new Error('macOS packaging must be run on macOS.')
  }
}

export function resolveNpmCommand() {
  if (process.env.npm_execpath) {
    return {
      command: process.execPath,
      baseArgs: [process.env.npm_execpath]
    }
  }

  return {
    command: 'npm',
    baseArgs: []
  }
}

export function runNpm(args, options = {}) {
  const npm = resolveNpmCommand()
  return run(npm.command, [...npm.baseArgs, ...args], options)
}

export function resolveElectronBuilderCommand() {
  const binaryName = process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder'
  const localBinaryPath = resolve(clientRoot, 'node_modules', '.bin', binaryName)
  if (existsSync(localBinaryPath)) {
    return {
      command: localBinaryPath,
      baseArgs: []
    }
  }

  const npm = resolveNpmCommand()
  return {
    command: npm.command,
    baseArgs: [...npm.baseArgs, 'exec', 'electron-builder', '--']
  }
}

export function runElectronBuilder(args, options = {}) {
  const builder = resolveElectronBuilderCommand()
  return run(builder.command, [...builder.baseArgs, ...args], options)
}

export function getPackageVersion() {
  const packageJsonPath = resolve(clientRoot, 'package.json')
  const result = run(
    process.execPath,
    ['-e', `process.stdout.write(require(${JSON.stringify(packageJsonPath)}).version)`],
    { capture: true }
  )
  return String(result.stdout).trim()
}

export function getExpectedMacArtifactPath(arch, ext) {
  return resolve(outputRoot, `DicomVision-${getPackageVersion()}-mac-${arch}.${ext}`)
}

export function getServerExecutablePath(bundlePath = stagedServerBundlePath) {
  return resolve(bundlePath, 'DicomVisionServer')
}

export function hasMacServerExecutable(bundlePath = stagedServerBundlePath) {
  return existsSync(getServerExecutablePath(bundlePath))
}

export function assertDirectory(path, label) {
  if (!existsSync(path)) {
    throw new Error(`${label} does not exist: ${path}`)
  }
  if (!statSync(path).isDirectory()) {
    throw new Error(`${label} must be a directory: ${path}`)
  }
}

export function readCommand(command, args, options = {}) {
  const result = run(command, args, { ...options, capture: true, allowFailure: true })
  return {
    ok: result.status === 0,
    stdout: String(result.stdout ?? '').trim(),
    stderr: String(result.stderr ?? '').trim(),
    status: result.status ?? 1
  }
}

export function hasAppleIdNotarizeCredentials(env = process.env) {
  return Boolean(env.APPLE_ID && env.APPLE_APP_SPECIFIC_PASSWORD && env.APPLE_TEAM_ID)
}

export function hasAppStoreConnectNotarizeCredentials(env = process.env) {
  return Boolean(env.APPLE_API_KEY && env.APPLE_API_KEY_ID && env.APPLE_API_ISSUER)
}

export function hasNotarizeCredentials(env = process.env) {
  return hasAppleIdNotarizeCredentials(env) || hasAppStoreConnectNotarizeCredentials(env)
}

export function findSigningIdentity() {
  if (process.platform !== 'darwin') {
    return null
  }

  if (process.env.CSC_NAME?.trim()) {
    return process.env.CSC_NAME.trim()
  }

  const result = readCommand('security', ['find-identity', '-v', '-p', 'codesigning'])
  if (!result.ok) {
    return null
  }

  const identities = result.stdout
    .split('\n')
    .map((line) => {
      const match = line.match(/"(.+)"$/)
      return match?.[1] ?? ''
    })
    .filter(Boolean)

  return identities.find((identity) => identity.includes('Developer ID Application')) ?? identities[0] ?? null
}

export function resolveSigningPlan({ signMode, notarizeMode }) {
  const identity = findSigningIdentity()
  const notarizeCredentialsAvailable = hasNotarizeCredentials()

  if (signMode === 'never') {
    if (notarizeMode === 'required') {
      throw new Error('Notarization requires signing. Use --sign auto or --sign required.')
    }
    return {
      signEnabled: false,
      notarizeEnabled: false,
      identity: null,
      reason: 'Signing disabled by --sign never.'
    }
  }

  if (!identity) {
    if (signMode === 'required') {
      throw new Error('No macOS code signing identity was found. Install a Developer ID Application certificate or set CSC_NAME.')
    }
    if (notarizeMode === 'required') {
      throw new Error('Notarization requires a macOS code signing identity.')
    }
    return {
      signEnabled: false,
      notarizeEnabled: false,
      identity: null,
      reason: 'No code signing identity found; building an unsigned local validation package.'
    }
  }

  if (notarizeMode === 'never') {
    return {
      signEnabled: true,
      notarizeEnabled: false,
      identity,
      reason: 'Signing enabled; notarization disabled by --notarize never.'
    }
  }

  if (!notarizeCredentialsAvailable) {
    if (notarizeMode === 'required') {
      throw new Error(
        'No Apple notarization credentials found. Set APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD/APPLE_TEAM_ID or APPLE_API_KEY/APPLE_API_KEY_ID/APPLE_API_ISSUER.'
      )
    }
    return {
      signEnabled: true,
      notarizeEnabled: false,
      identity,
      reason: 'Signing enabled; notarization credentials were not found, so notarization is skipped in auto mode.'
    }
  }

  return {
    signEnabled: true,
    notarizeEnabled: true,
    identity,
    reason: 'Signing and notarization enabled.'
  }
}

export function createMacBuildEnv({ signMode, notarizeMode, signingPlan, arch }) {
  const env = {
    ...process.env,
    DICOM_VISION_MAC_ARCH: arch,
    DICOM_VISION_MAC_SIGN_MODE: signingPlan.signEnabled ? signMode : 'never',
    DICOM_VISION_MAC_NOTARIZE_MODE: signingPlan.notarizeEnabled ? notarizeMode : 'never'
  }

  if (signingPlan.identity) {
    env.CSC_NAME = signingPlan.identity
    env.DICOM_VISION_MAC_SIGN_IDENTITY = signingPlan.identity
  } else {
    env.CSC_IDENTITY_AUTO_DISCOVERY = 'false'
  }

  return env
}

export function printPreflightMessage(message) {
  console.log(`[macOS release] ${message}`)
}
