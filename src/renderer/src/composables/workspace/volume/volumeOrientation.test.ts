import { describe, expect, it } from 'vitest'
import {
  createVolumeOrientationQuaternion,
  resolveVolumeOrientationFace,
  VOLUME_ORIENTATION_FACES
} from './volumeOrientation'

describe('volumeOrientation', () => {
  it('round trips all six anatomical faces', () => {
    for (const face of VOLUME_ORIENTATION_FACES) {
      expect(resolveVolumeOrientationFace(createVolumeOrientationQuaternion(face))).toBe(face)
    }
  })

  it('returns free orientation when no face is within the snap angle', () => {
    const halfAngle = 30 * Math.PI / 360
    const oblique: [number, number, number, number] = [Math.sin(halfAngle), 0, 0, Math.cos(halfAngle)]

    expect(resolveVolumeOrientationFace(oblique)).toBeNull()
  })
})
