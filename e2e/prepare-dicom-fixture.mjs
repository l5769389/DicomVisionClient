import { cp, mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceDirectory = resolve(clientRoot, '../DicomVisionServer/sample-data/test')
const targetDirectory = resolve(clientRoot, 'test-results/e2e-dicom-series')

await rm(targetDirectory, { recursive: true, force: true })
await mkdir(dirname(targetDirectory), { recursive: true })
await cp(sourceDirectory, targetDirectory, { recursive: true })
