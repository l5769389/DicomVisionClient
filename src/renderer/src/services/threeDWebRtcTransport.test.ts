import { beforeEach, describe, expect, it, vi } from 'vitest'

const socketMocks = vi.hoisted(() => ({
  bindView: vi.fn(),
  closeWebRtc3DTransport: vi.fn(),
  requestWebRtc3DConfig: vi.fn(),
  sendWebRtc3DOffer: vi.fn()
}))

vi.mock('./socket', () => socketMocks)

class FakePeerConnection {
  connectionState: RTCPeerConnectionState = 'new'
  iceGatheringState: RTCIceGatheringState = 'complete'
  localDescription: RTCSessionDescription | null = null
  ontrack: ((event: RTCTrackEvent) => void) | null = null
  onconnectionstatechange: (() => void) | null = null

  addTransceiver(): void {}
  addEventListener(): void {}
  removeEventListener(): void {}

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: 'offer', sdp: 'local-offer' }
  }

  async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = description as RTCSessionDescription
  }

  async setRemoteDescription(): Promise<void> {
    this.connectionState = 'connected'
    const stream = { id: 'stream-1' } as MediaStream
    this.ontrack?.({ streams: [stream], track: {}, receiver: fakeReceiver as RTCRtpReceiver } as unknown as RTCTrackEvent)
    this.onconnectionstatechange?.()
  }

  close(): void {
    this.connectionState = 'closed'
  }
}

const fakeReceiver: { jitterBufferTarget?: number | null; playoutDelayHint?: number | null } = {}

async function flushPromises(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise((resolve) => window.setTimeout(resolve, 0))
}

describe('threeDWebRtcTransport', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
    delete fakeReceiver.jitterBufferTarget
    delete fakeReceiver.playoutDelayHint
    socketMocks.requestWebRtc3DConfig.mockResolvedValue({
      ok: true,
      transport: 'webrtc',
      iceServers: [],
      videoCodec: 'vp8',
      videoBitrateBps: 4_000_000,
      videoFps: 60
    })
    socketMocks.sendWebRtc3DOffer.mockResolvedValue({
      ok: true,
      viewId: 'view-3d',
      type: 'answer',
      sdp: 'remote-answer'
    })
  })

  it('negotiates a receive-only track and requests a render after the answer', async () => {
    const transport = await import('./threeDWebRtcTransport')

    await transport.initializeThreeDTransport()
    transport.acquireThreeDWebRtcTransport('view-3d')
    await flushPromises()

    expect(socketMocks.requestWebRtc3DConfig).toHaveBeenCalledOnce()
    expect(socketMocks.sendWebRtc3DOffer).toHaveBeenCalledWith(
      'view-3d',
      expect.objectContaining({ type: 'offer', sdp: 'local-offer' })
    )
    expect(socketMocks.bindView).toHaveBeenCalledWith('view-3d')
    expect(transport.getThreeDWebRtcState('view-3d')).toBe('connected')
    expect(transport.getThreeDWebRtcStream('view-3d')).toEqual({ id: 'stream-1' })
    expect(fakeReceiver.playoutDelayHint).toBe(0)
    expect(fakeReceiver.jitterBufferTarget).toBe(0)

    transport.releaseThreeDWebRtcTransport('view-3d')
    expect(socketMocks.closeWebRtc3DTransport).toHaveBeenCalledWith('view-3d')
  })

  it('falls back to WebP when signaling fails', async () => {
    socketMocks.sendWebRtc3DOffer.mockResolvedValue({ ok: false, message: 'no route' })
    const transport = await import('./threeDWebRtcTransport')

    await transport.initializeThreeDTransport()
    transport.acquireThreeDWebRtcTransport('view-fallback')
    await flushPromises()

    expect(transport.getThreeDWebRtcState('view-fallback')).toBe('failed')
    expect(socketMocks.bindView).toHaveBeenCalledWith('view-fallback')
    expect(socketMocks.closeWebRtc3DTransport).toHaveBeenCalledWith('view-fallback')
    transport.releaseThreeDWebRtcTransport('view-fallback')
  })

  it('uses WebP without negotiating when the server startup mode is WebP', async () => {
    socketMocks.requestWebRtc3DConfig.mockResolvedValue({ ok: true, transport: 'webp' })
    const transport = await import('./threeDWebRtcTransport')

    expect(await transport.initializeThreeDTransport()).toBe('webp')
    transport.acquireThreeDWebRtcTransport('view-webp')
    await flushPromises()

    expect(socketMocks.sendWebRtc3DOffer).not.toHaveBeenCalled()
    expect(transport.threeDTransportMode.value).toBe('webp')
    transport.releaseThreeDWebRtcTransport('view-webp')
  })

  it('keeps the final still until the announced WebRTC preview frame is presented', async () => {
    const transport = await import('./threeDWebRtcTransport')

    transport.applyThreeDFrameTransportUpdate({
      viewId: 'view-3d',
      imageTransport: 'webp-final',
      fastPreview: false
    })
    expect(transport.shouldShowThreeDFinalStill('view-3d')).toBe(true)

    transport.applyThreeDFrameTransportUpdate({
      viewId: 'view-3d',
      imageTransport: 'webrtc',
      fastPreview: true
    })
    const generation = transport.getPendingThreeDVideoFrameGeneration('view-3d')
    expect(generation).toBe(1)
    expect(transport.shouldShowThreeDFinalStill('view-3d')).toBe(true)
    expect(transport.shouldShowThreeDStillFrame('view-3d')).toBe(true)
    expect(transport.hasPresentedThreeDVideoFrame('view-3d')).toBe(false)
    expect(transport.acknowledgeThreeDVideoFrame('view-3d', 99)).toBe(false)
    expect(transport.shouldShowThreeDFinalStill('view-3d')).toBe(true)

    expect(transport.acknowledgeThreeDVideoFrame('view-3d', generation!)).toBe(false)
    expect(transport.shouldShowThreeDFinalStill('view-3d')).toBe(true)
    expect(transport.hasPresentedThreeDVideoFrame('view-3d')).toBe(false)

    expect(transport.acknowledgeThreeDVideoFrame('view-3d', generation!)).toBe(true)
    expect(transport.shouldShowThreeDFinalStill('view-3d')).toBe(false)
    expect(transport.shouldShowThreeDStillFrame('view-3d')).toBe(false)
    expect(transport.hasPresentedThreeDVideoFrame('view-3d')).toBe(true)
    expect(transport.getPendingThreeDVideoFrameGeneration('view-3d')).toBeNull()

    // Once video has presented pixels, ordinary consecutive previews remain
    // on video and do not repeatedly hide it behind a handoff generation.
    transport.applyThreeDFrameTransportUpdate({
      viewId: 'view-3d',
      imageTransport: 'webrtc',
      fastPreview: true
    })
    expect(transport.getPendingThreeDVideoFrameGeneration('view-3d')).toBeNull()

    transport.applyThreeDFrameTransportUpdate({
      viewId: 'view-3d',
      imageTransport: 'webp-final',
      fastPreview: false
    })
    transport.applyThreeDFrameTransportUpdate({
      viewId: 'view-3d',
      imageTransport: 'webrtc',
      fastPreview: true
    })
    expect(transport.getPendingThreeDVideoFrameGeneration('view-3d')).toBe(2)
    expect(transport.acknowledgeThreeDVideoFrame('view-3d', generation!)).toBe(false)
  })

  it('does not restart the two-frame handoff for consecutive preview metadata', async () => {
    const transport = await import('./threeDWebRtcTransport')

    transport.applyThreeDFrameTransportUpdate({
      viewId: 'view-3d',
      imageTransport: 'webp-final',
      fastPreview: false
    })
    transport.applyThreeDFrameTransportUpdate({
      viewId: 'view-3d',
      imageTransport: 'webrtc',
      fastPreview: true
    })
    const generation = transport.getPendingThreeDVideoFrameGeneration('view-3d')!
    expect(transport.acknowledgeThreeDVideoFrame('view-3d', generation)).toBe(false)

    transport.applyThreeDFrameTransportUpdate({
      viewId: 'view-3d',
      imageTransport: 'webrtc',
      fastPreview: true
    })
    expect(transport.getPendingThreeDVideoFrameGeneration('view-3d')).toBe(generation)
    expect(transport.acknowledgeThreeDVideoFrame('view-3d', generation)).toBe(true)
    expect(transport.shouldShowThreeDStillFrame('view-3d')).toBe(false)
  })

  it('keeps video hidden before the first two frames have been presented', async () => {
    const transport = await import('./threeDWebRtcTransport')

    expect(transport.shouldShowThreeDStillFrame('view-3d')).toBe(true)
    expect(transport.hasPresentedThreeDVideoFrame('view-3d')).toBe(false)
    transport.applyThreeDFrameTransportUpdate({
      viewId: 'view-3d',
      imageTransport: 'webrtc',
      fastPreview: true
    })
    const generation = transport.getPendingThreeDVideoFrameGeneration('view-3d')!

    expect(transport.acknowledgeThreeDVideoFrame('view-3d', generation)).toBe(false)
    expect(transport.shouldShowThreeDStillFrame('view-3d')).toBe(true)
    expect(transport.acknowledgeThreeDVideoFrame('view-3d', generation)).toBe(true)
    expect(transport.hasPresentedThreeDVideoFrame('view-3d')).toBe(true)
  })

  it('does not let a late preview callback uncover a newer final still', async () => {
    const transport = await import('./threeDWebRtcTransport')

    transport.applyThreeDFrameTransportUpdate({
      viewId: 'view-3d',
      imageTransport: 'webrtc',
      fastPreview: true
    })
    const staleGeneration = transport.getPendingThreeDVideoFrameGeneration('view-3d')!
    transport.applyThreeDFrameTransportUpdate({
      viewId: 'view-3d',
      imageTransport: 'webp-final',
      fastPreview: false
    })

    expect(transport.acknowledgeThreeDVideoFrame('view-3d', staleGeneration)).toBe(false)
    expect(transport.shouldShowThreeDFinalStill('view-3d')).toBe(true)
  })

  it('keeps final still state isolated per 3D view and clears it on release', async () => {
    const transport = await import('./threeDWebRtcTransport')

    transport.applyThreeDFrameTransportUpdate({ viewId: 'view-a', imageTransport: 'webp-final' })
    transport.applyThreeDFrameTransportUpdate({ viewId: 'view-b', imageTransport: 'webp-final' })
    transport.acquireThreeDWebRtcTransport('view-a')
    transport.releaseThreeDWebRtcTransport('view-a')

    expect(transport.shouldShowThreeDFinalStill('view-a')).toBe(false)
    expect(transport.shouldShowThreeDFinalStill('view-b')).toBe(true)
    transport.closeAllThreeDWebRtcTransports()
    expect(transport.shouldShowThreeDFinalStill('view-b')).toBe(false)
  })
})
