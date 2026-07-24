import { cp, mkdir, rm } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pairedServerDirectory = basename(clientRoot).replace('Client', 'Server')
const serverRoot = resolve(
  process.env.DICOM_VISION_E2E_SERVER_ROOT ?? resolve(clientRoot, '..', pairedServerDirectory)
)
const sourceDirectory = resolve(serverRoot, 'sample-data/test')
const targetDirectory = resolve(clientRoot, 'test-results/e2e-dicom-series')

await rm(targetDirectory, { recursive: true, force: true })
await mkdir(dirname(targetDirectory), { recursive: true })
await cp(sourceDirectory, targetDirectory, { recursive: true })
