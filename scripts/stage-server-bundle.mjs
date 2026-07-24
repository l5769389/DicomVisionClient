import { chmod, cp, rm } from 'node:fs/promises'
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const clientRoot = resolve(__dirname, '..')
const stagingRoot = resolve(clientRoot, 'dist-server')
const targetBundlePath = resolve(stagingRoot, 'DicomVisionServer')

function parseArgs() {
  const args = process.argv.slice(2)
  const parsed = {
    bundlePath: process.env.DICOM_VISION_SERVER_BUNDLE_PATH ?? ''
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--bundle-path' || arg === '--bundlePath') {
      parsed.bundlePath = args[index + 1] ?? ''
      index += 1
    }
  }

  return parsed
}

function hasServerExecutable(bundlePath) {
  return existsSync(resolve(bundlePath, 'DicomVisionServer.exe')) || existsSync(resolve(bundlePath, 'DicomVisionServer'))
}

function resolveServerBundlePath(candidatePath) {
  if (!candidatePath || !candidatePath.trim()) {
    throw new Error('Server bundle path is required. Pass --bundle-path or set DICOM_VISION_SERVER_BUNDLE_PATH.')
  }

  const resolvedPath = resolve(candidatePath)
  if (!existsSync(resolvedPath)) {
    throw new Error(`Server bundle path does not exist: ${resolvedPath}`)
  }

  const item = statSync(resolvedPath)
  if (!item.isDirectory()) {
    throw new Error(`Server bundle path must be a directory: ${resolvedPath}`)
  }

  if (hasServerExecutable(resolvedPath)) {
    return resolvedPath
  }

  const nestedBundle = resolve(resolvedPath, 'DicomVisionServer')
  if (existsSync(nestedBundle) && statSync(nestedBundle).isDirectory() && hasServerExecutable(nestedBundle)) {
    return nestedBundle
  }

  throw new Error(
    `Server bundle directory is invalid: ${resolvedPath}. Expected a folder containing DicomVisionServer or DicomVisionServer.exe.`
  )
}

const sourceBundlePath = resolveServerBundlePath(parseArgs().bundlePath)
await rm(targetBundlePath, { recursive: true, force: true })
await cp(sourceBundlePath, targetBundlePath, { recursive: true })

const macExecutablePath = resolve(targetBundlePath, 'DicomVisionServer')
if (existsSync(macExecutablePath)) {
  await chmod(macExecutablePath, 0o755)
}

console.log(`Staged server bundle: ${sourceBundlePath} -> ${targetBundlePath}`)
