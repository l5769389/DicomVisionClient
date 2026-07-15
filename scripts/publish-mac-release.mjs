import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const clientRoot = resolve(__dirname, '..')
const packageJson = JSON.parse(readFileSync(resolve(clientRoot, 'package.json'), 'utf8'))
const defaultRepo = process.env.GITHUB_REPOSITORY || 'l5769389/DicomVisionClient'

function parseArgs() {
  const args = process.argv.slice(2)
  const parsed = {
    tag: process.env.RELEASE_TAG || `v${packageJson.version}`,
    repo: process.env.GITHUB_REPOSITORY || defaultRepo,
    skipBuild: false
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--tag') {
      parsed.tag = args[index + 1] || parsed.tag
      index += 1
    } else if (arg === '--repo') {
      parsed.repo = args[index + 1] || parsed.repo
      index += 1
    } else if (arg === '--skip-build') {
      parsed.skipBuild = true
    }
  }

  return parsed
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? clientRoot,
    env: { ...process.env, ...(options.env ?? {}) },
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

function hasCommand(command) {
  const result = spawnSync(command, ['--version'], { stdio: 'ignore', shell: process.platform === 'win32' })
  return !result.error && result.status === 0
}

if (process.platform !== 'darwin') {
  throw new Error('macOS release publishing must be run on macOS.')
}

const args = parseArgs()
const version = args.tag.replace(/^v/, '')
if (!/^v\d+\.\d+\.\d+$/.test(args.tag)) {
  throw new Error(`Release tag must use the vX.Y.Z format. Received: ${args.tag}`)
}
if (version !== packageJson.version) {
  throw new Error(`Release tag ${args.tag} does not match package version ${packageJson.version}.`)
}
if (!hasCommand('gh')) {
  throw new Error('GitHub CLI (gh) is required. Authenticate with: gh auth login')
}

const distRoot = resolve(clientRoot, 'dist-electron')
const assetNames = [
  `DicomVision-${version}-Setup.dmg`,
  `DicomVision-${version}-Setup.dmg.blockmap`,
  `DicomVision-${version}-Setup.zip`,
  `DicomVision-${version}-Setup.zip.blockmap`,
  'latest-mac.yml'
]

if (!args.skipBuild) {
  console.log(`Building macOS release assets for ${args.tag}...`)
  run('npm', ['run', 'release:mac'], {
    env: {
      NPM_CONFIG_ELECTRON_BUILDER_BINARIES_MIRROR:
        'https://github.com/electron-userland/electron-builder-binaries/releases/download/',
      ELECTRON_BUILDER_BINARIES_MIRROR:
        'https://github.com/electron-userland/electron-builder-binaries/releases/download/'
    }
  })
}

const missingAssets = assetNames.filter((name) => !existsSync(resolve(distRoot, name)))
if (missingAssets.length > 0) {
  throw new Error(`Missing macOS release assets: ${missingAssets.join(', ')}`)
}

const checksumPath = resolve(distRoot, 'SHA256SUMS-macos.txt')
const checksumNames = [`DicomVision-${version}-Setup.dmg`, `DicomVision-${version}-Setup.zip`]
const checksumLines = checksumNames.map((name) => {
  const result = spawnSync('shasum', ['-a', '256', resolve(distRoot, name)], { encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`Unable to calculate SHA-256 for ${name}`)
  }
  return `${result.stdout.trim().split(/\s+/)[0]}  ${name}`
})
writeFileSync(checksumPath, `${checksumLines.join('\n')}\n`, 'utf8')

const releaseView = spawnSync('gh', ['release', 'view', args.tag, '--repo', args.repo], {
  cwd: clientRoot,
  stdio: 'ignore'
})
if (releaseView.status !== 0) {
  const notesPath = resolve(clientRoot, 'release-notes', `${args.tag}.md`)
  const createArgs = ['release', 'create', args.tag, '--repo', args.repo, '--verify-tag', '--title', `DicomVision ${args.tag}`]
  if (existsSync(notesPath)) {
    createArgs.push('--notes-file', notesPath)
  }
  run('gh', createArgs)
}

const uploadPaths = [...assetNames, 'SHA256SUMS-macos.txt'].map((name) => resolve(distRoot, name))
console.log(`Uploading macOS assets to ${args.repo} ${args.tag}...`)
run('gh', ['release', 'upload', args.tag, ...uploadPaths, '--repo', args.repo, '--clobber'])
console.log(`macOS release assets published: ${args.tag}`)
