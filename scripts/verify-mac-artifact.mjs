import { mkdtemp, rm } from 'node:fs/promises'
import { existsSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  assertMacOS,
  clientRoot,
  getExpectedMacArtifactPath,
  getHostMacArch,
  normalizeMacArch,
  outputRoot,
  readCommand,
  run
} from './mac-release-utils.mjs'

function parseArgs() {
  const args = process.argv.slice(2)
  const parsed = {
    arch: normalizeMacArch(process.env.DICOM_VISION_MAC_ARCH || 'host'),
    signed: false,
    notarized: false,
    smoke: 'auto'
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--arch') {
      parsed.arch = normalizeMacArch(args[index + 1] ?? 'host')
      index += 1
    } else if (arg === '--signed') {
      parsed.signed = (args[index + 1] ?? '').toLowerCase() === 'yes'
      index += 1
    } else if (arg === '--notarized') {
      parsed.notarized = (args[index + 1] ?? '').toLowerCase() === 'yes'
      index += 1
    } else if (arg === '--smoke') {
      parsed.smoke = (args[index + 1] ?? 'auto').toLowerCase()
      index += 1
    }
  }

  if (parsed.arch === 'all') {
    throw new Error('verify-mac-artifact verifies one architecture at a time.')
  }
  if (parsed.arch === 'host') {
    parsed.arch = getHostMacArch()
  }

  return parsed
}

function assertFileExists(path, label) {
  if (!existsSync(path)) {
    throw new Error(`${label} was not found: ${path}`)
  }
  if (!statSync(path).isFile()) {
    throw new Error(`${label} is not a file: ${path}`)
  }
}

function assertDirectoryExists(path, label) {
  if (!existsSync(path)) {
    throw new Error(`${label} was not found: ${path}`)
  }
  if (!statSync(path).isDirectory()) {
    throw new Error(`${label} is not a directory: ${path}`)
  }
}

function assertExecutableArchitecture(executablePath, arch) {
  const fileResult = readCommand('file', [executablePath])
  if (!fileResult.ok) {
    throw new Error(`Failed to inspect executable architecture: ${fileResult.stderr}`)
  }

  const expectedToken = arch === 'x64' ? 'x86_64' : 'arm64'
  if (!fileResult.stdout.includes(expectedToken)) {
    throw new Error(`Expected ${expectedToken} executable, but file reported: ${fileResult.stdout}`)
  }
}

function verifyAppBundle(appPath, args) {
  const appExecutablePath = join(appPath, 'Contents', 'MacOS', 'DicomVision')
  const serverExecutablePath = join(appPath, 'Contents', 'Resources', 'server', 'DicomVisionServer')

  assertDirectoryExists(appPath, 'App bundle')
  assertFileExists(appExecutablePath, 'App executable')
  assertFileExists(serverExecutablePath, 'Embedded backend executable')
  assertExecutableArchitecture(appExecutablePath, args.arch)
  assertExecutableArchitecture(serverExecutablePath, args.arch)

  if (args.signed) {
    run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath])
    run('codesign', ['--verify', '--strict', '--verbose=2', serverExecutablePath])
    run('spctl', ['--assess', '--type', 'execute', '--verbose=2', appPath], { allowFailure: true })
  }

  if (args.notarized) {
    run('xcrun', ['stapler', 'validate', appPath])
  }
}

function findBuiltAppPath(arch) {
  const candidates = [
    resolve(outputRoot, `mac-${arch}`, 'DicomVision.app'),
    resolve(outputRoot, arch === 'x64' ? 'mac' : `mac-${arch}`, 'DicomVision.app'),
    resolve(outputRoot, 'mac', 'DicomVision.app')
  ]
  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

async function verifyDmg(dmgPath, args) {
  const mountRoot = await mkdtemp(join(tmpdir(), 'dicomvision-dmg-'))
  try {
    run('hdiutil', ['attach', dmgPath, '-nobrowse', '-readonly', '-mountpoint', mountRoot])
    const mountedAppPath = join(mountRoot, 'DicomVision.app')
    verifyAppBundle(mountedAppPath, args)
  } finally {
    run('hdiutil', ['detach', mountRoot], { allowFailure: true })
    await rm(mountRoot, { recursive: true, force: true })
  }
}

function shouldRunSmoke(args) {
  if (args.smoke === 'never') {
    return false
  }
  if (args.smoke === 'always') {
    return true
  }
  return args.arch === getHostMacArch()
}

function runSmokeTest(appPath) {
  const executablePath = join(appPath, 'Contents', 'MacOS', 'DicomVision')
  run(executablePath, ['--smoke-test'], {
    env: {
      ...process.env,
      DICOM_VISION_DESKTOP_SMOKE: '1'
    },
    timeoutMs: 60000
  })
}

const args = parseArgs()
assertMacOS()

const dmgPath = getExpectedMacArtifactPath(args.arch, 'dmg')
const zipPath = getExpectedMacArtifactPath(args.arch, 'zip')
assertFileExists(dmgPath, 'macOS DMG artifact')
assertFileExists(zipPath, 'macOS ZIP artifact')

const builtAppPath = findBuiltAppPath(args.arch)
if (builtAppPath) {
  verifyAppBundle(builtAppPath, args)
  if (shouldRunSmoke(args)) {
    runSmokeTest(builtAppPath)
  }
}

await verifyDmg(dmgPath, args)
console.log(`Verified macOS artifacts for ${args.arch}`)
