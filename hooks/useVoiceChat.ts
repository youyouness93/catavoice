import { useState, useEffect } from 'react'
import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ILocalAudioTrack,
} from 'agora-rtc-sdk-ng'

const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID || ''

export function useVoiceChat(channelName: string, userId: string) {
  const [client, setClient] = useState<IAgoraRTCClient | null>(null)
  const [localAudioTrack, setLocalAudioTrack] = useState<ILocalAudioTrack | null>(null)
  const [users, setUsers] = useState<IAgoraRTCRemoteUser[]>([])
  const [isMuted, setIsMuted] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)

  const requestMicrophonePermission = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      return true
    } catch (error) {
      console.error('Microphone permission denied:', error)
      setPermissionError('Veuillez autoriser l\'accès au microphone pour utiliser le chat vocal')
      return false
    }
  }

  useEffect(() => {
    let mounted = true
    const init = async () => {
      if (!appId) {
        console.error('Agora App ID is not configured')
        return
      }

      // Request microphone permission first
      const hasPermission = await requestMicrophonePermission()
      if (!hasPermission) {
        return
      }

      const agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })
      if (mounted) {
        setClient(agoraClient)
      }

      // Listen for remote users joining
      agoraClient.on('user-published', async (user, mediaType) => {
        await agoraClient.subscribe(user, mediaType)
        if (mediaType === 'audio') {
          user.audioTrack?.play()
          if (mounted) {
            setUsers(prev => [...prev, user])
          }
        }
      })

      // Listen for remote users leaving
      agoraClient.on('user-unpublished', (user) => {
        if (mounted) {
          setUsers(prev => prev.filter(u => u.uid !== user.uid))
        }
      })

      try {
        // Join the channel
        await agoraClient.join(appId, channelName, null, userId)
        
        // Create and publish local audio track
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack()
        if (mounted) {
          setLocalAudioTrack(audioTrack)
          setPermissionError(null) // Clear any previous error
        }
        await agoraClient.publish(audioTrack)
      } catch (error) {
        console.error('Error joining voice chat:', error)
        if (error.message.includes('Permission denied')) {
          setPermissionError('Veuillez autoriser l\'accès au microphone pour utiliser le chat vocal')
        }
      }
    }

    init()

    // Cleanup
    return () => {
      mounted = false
      if (localAudioTrack) {
        localAudioTrack.stop()
        localAudioTrack.close()
      }
      if (client) {
        client.removeAllListeners()
        client.leave()
      }
    }
  }, [channelName, userId])

  const toggleMute = () => {
    if (localAudioTrack) {
      if (isMuted) {
        localAudioTrack.setEnabled(true)
      } else {
        localAudioTrack.setEnabled(false)
      }
      setIsMuted(!isMuted)
    }
  }

  const leaveChannel = async () => {
    if (localAudioTrack) {
      localAudioTrack.stop()
      localAudioTrack.close()
    }
    await client?.leave()
    setUsers([])
  }

  return {
    users,
    isMuted,
    toggleMute,
    leaveChannel,
    permissionError
  }
}
