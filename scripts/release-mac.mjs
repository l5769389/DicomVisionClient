import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const clientRoot = resolve(__dirname, '..')
const defaultServerRepoPath = resolve(clientRoot, '..', 'DicomVisionServer')

function parseArgs() {
  const args = process.argv.slice(2)
  const parsed = {
    serverRepoPath: defaultServerRepoPath,
    serverOutputRoot: '',
    bundleName: 'DicomVisionServer',
    targetArch: ''
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
    } else if (arg === '--target-arch' || arg === '--targetArch') {
      parsed.targetArch = args[index + 1] ?? ''
      index += 1
    }
  }

  return parsed
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? clientRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })

  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`)
  }
}

if (process.platform !== 'darwin') {
  throw new Error('macOS release packaging must be run on macOS.')
}

const args = parseArgs()
const serverRepoPath = resolve(args.serverRepoPath)
const serverOutputRoot = args.serverOutputRoot || resolve(serverRepoPath, 'dist')
const serverBuildScript = resolve(serverRepoPath, 'scripts', 'build_desktop_bundle.py')
const serverBundlePath = resolve(serverOutputRoot, args.bundleName)
const serverExecutablePath = resolve(serverBundlePath, args.bundleName)
const pythonCommand = process.env.PYTHON || 'python3'

if (!existsSync(serverBuildScript)) {
  throw new Error(`Server build script not found: ${serverBuildScript}`)
}

const serverBuildArgs = [
  serverBuildScript,
  '--output-root',
  serverOutputRoot,
  '--bundle-name',
  args.bundleName
]
if (args.targetArch) {
  serverBuildArgs.push('--target-arch', args.targetArch)
}

run(pythonCommand, serverBuildArgs, { cwd: serverRepoPath })

if (!existsSync(serverExecutablePath)) {
  throw new Error(`Built server bundle is missing expected executable: ${serverExecutablePath}`)
}

run('node', [resolve(clientRoot, 'scripts', 'package-mac.mjs'), '--server-bundle-path', serverBundlePath])
