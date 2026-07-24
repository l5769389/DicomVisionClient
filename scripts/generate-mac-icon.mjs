import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { clientRoot, commandExists, run } from './mac-release-utils.mjs'

const sourceIconPath = resolve(clientRoot, 'build', 'icon.png')
const outputIconPath = resolve(clientRoot, 'build', 'icon.icns')

if (process.platform !== 'darwin') {
  if (!existsSync(outputIconPath)) {
    throw new Error('build/icon.icns is missing. Generate it on macOS before packaging.')
  }
  process.exit(0)
}

if (!existsSync(sourceIconPath)) {
  throw new Error(`Source icon not found: ${sourceIconPath}`)
}

if (!commandExists('sips')) {
  throw new Error('sips was not found. macOS icon generation requires the system sips tool.')
}

const iconsetPath = await mkdtemp(join(tmpdir(), 'dicomvision-iconset-'))
const iconsetDirectory = `${iconsetPath}.iconset`

function createIcnsBuffer(entries) {
  const totalLength = 8 + entries.reduce((total, entry) => total + 8 + entry.data.length, 0)
  const header = Buffer.alloc(8)
  header.write('icns', 0, 'ascii')
  header.writeUInt32BE(totalLength, 4)

  const chunks = [header]
  for (const entry of entries) {
    const chunkHeader = Buffer.alloc(8)
    chunkHeader.write(entry.type, 0, 'ascii')
    chunkHeader.writeUInt32BE(8 + entry.data.length, 4)
    chunks.push(chunkHeader, entry.data)
  }

  return Buffer.concat(chunks, totalLength)
}

async function writeIcnsFallback(iconsetDirectory) {
  const entries = [
    ['icp4', 'icon_16x16.png'],
    ['icp5', 'icon_32x32.png'],
    ['icp6', 'icon_32x32@2x.png'],
    ['ic07', 'icon_128x128.png'],
    ['ic08', 'icon_256x256.png'],
    ['ic09', 'icon_256x256@2x.png'],
    ['ic10', 'icon_512x512@2x.png']
  ]

  const buffers = []
  for (const [type, fileName] of entries) {
    buffers.push({
      type,
      data: await readFile(join(iconsetDirectory, fileName))
    })
  }

  await writeFile(outputIconPath, createIcnsBuffer(buffers))
}

try {
  await rm(iconsetDirectory, { recursive: true, force: true })
  run('mkdir', ['-p', iconsetDirectory])

  const sizes = [
    [16, 'icon_16x16.png'],
    [32, 'icon_16x16@2x.png'],
    [32, 'icon_32x32.png'],
    [64, 'icon_32x32@2x.png'],
    [128, 'icon_128x128.png'],
    [256, 'icon_128x128@2x.png'],
    [256, 'icon_256x256.png'],
    [512, 'icon_256x256@2x.png'],
    [512, 'icon_512x512.png'],
    [1024, 'icon_512x512@2x.png']
  ]

  for (const [size, fileName] of sizes) {
    run('sips', ['-z', String(size), String(size), sourceIconPath, '--out', join(iconsetDirectory, fileName)])
  }

  const iconutilResult = commandExists('iconutil')
    ? run('iconutil', ['-c', 'icns', iconsetDirectory, '-o', outputIconPath], { allowFailure: true })
    : { status: 1 }

  if (iconutilResult.status !== 0) {
    await writeIcnsFallback(iconsetDirectory)
  }

  console.log(`Generated ${outputIconPath}`)
} finally {
  await rm(iconsetDirectory, { recursive: true, force: true })
  await rm(iconsetPath, { recursive: true, force: true })
}
