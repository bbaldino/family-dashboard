import { useRef, useState, useCallback, useEffect } from 'react'

interface UseWebRtcStreamOptions {
  go2rtcUrl: string
  streamName: string
  enabled?: boolean
}

export function useWebRtcStream({
  go2rtcUrl,
  streamName,
  enabled = true,
}: UseWebRtcStreamOptions) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connect = useCallback(async () => {
    try {
      setError(null)
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      })
      pcRef.current = pc

      pc.addTransceiver('video', { direction: 'recvonly' })

      pc.ontrack = (event) => {
        if (videoRef.current) videoRef.current.srcObject = event.streams[0]
      }

      pc.onconnectionstatechange = () => {
        setIsConnected(pc.connectionState === 'connected')
        if (pc.connectionState === 'failed') setError('Connection failed')
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const response = await fetch(
        `${go2rtcUrl}/api/webrtc?src=${encodeURIComponent(streamName)}`,
        {
          method: 'POST',
          body: offer.sdp,
          headers: { 'Content-Type': 'application/sdp' },
        },
      )
      if (!response.ok) throw new Error(`go2rtc returned ${response.status}`)

      const answerSdp = await response.text()
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect')
    }
  }, [go2rtcUrl, streamName])

  const disconnect = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
      setIsConnected(false)
    }
  }, [])

  useEffect(() => {
    if (enabled) connect()
    return () => disconnect()
  }, [enabled, connect, disconnect])

  return { videoRef, isConnected, error, reconnect: connect }
}
