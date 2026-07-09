import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const clientRoot = resolve(__dirname, '..')
const stagedServerBundlePath = resolve(clientRoot, 'dist-server', 'DicomVisionServer')

function parseArgs() {
  const args = process.argv.slice(2)
  const parsed = {
    serverBundlePath: process.env.DICOM_VISION_SERVER_BUNDLE_PATH ?? ''
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--server-bundle-path' || arg === '--serverBundlePath') {
      parsed.serverBundlePath = args[index + 1] ?? ''
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

function hasMacServerExecutable() {
  return existsSync(resolve(stagedServerBundlePath, 'DicomVisionServer'))
}

if (process.platform !== 'darwin') {
  throw new Error('macOS packaging must be run on macOS because electron-builder cannot create macOS artifacts here.')
}

const args = parseArgs()

run('npm', ['run', 'build'])

if (args.serverBundlePath.trim()) {
  run('node', [resolve(clientRoot, 'scripts', 'stage-server-bundle.mjs'), '--bundle-path', args.serverBundlePath])
}

if (!existsSync(stagedServerBundlePath) || !hasMacServerExecutable()) {
  throw new Error(
    `macOS server bundle not found: ${stagedServerBundlePath}. Build it first with npm run release:mac or stage it with --server-bundle-path.`
  )
}

run('npx', ['electron-builder', '--mac', 'dmg', 'zip', '-c.mac.identity=null'])
