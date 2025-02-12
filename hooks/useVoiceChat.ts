import { useState, useEffect, useCallback, useRef } from 'react'
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng'

interface UseVoiceChatProps {
  appId: string
  channel: string
  uid: string
  isHost?: boolean
  isSpeaker?: boolean
  enabled?: boolean
}

export function useVoiceChat({ 
  appId, 
  channel, 
  uid, 
  isHost = false,
  isSpeaker = false,
  enabled = true 
}: UseVoiceChatProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [hasPermission, setHasPermission] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [agoraClient] = useState<IAgoraRTCClient>(() => 
    AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })
  )
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null)
  const mountedRef = useRef(true)
  const initializingRef = useRef(false)
  const canPublishRef = useRef(isHost || isSpeaker)

  // Nettoyer lors du démontage
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Gérer les événements de publication audio
  useEffect(() => {
    if (!enabled) return

    const handleUserPublished = async (user: any, mediaType: string) => {
      if (!mountedRef.current) return
      if (mediaType === "audio") {
        console.log("User published audio:", user.uid)
        try {
          // S'abonner à l'audio de l'utilisateur
          await agoraClient.subscribe(user, mediaType)
          console.log("Subscribed to user's audio:", user.uid)
          // Jouer l'audio
          user.audioTrack?.play()
          console.log("Playing user's audio:", user.uid)
        } catch (error) {
          console.error("Error subscribing to user audio:", error)
        }
      }
    }

    const handleUserUnpublished = async (user: any, mediaType: string) => {
      if (!mountedRef.current) return
      if (mediaType === "audio") {
        console.log("User unpublished audio:", user.uid)
        try {
          // Arrêter l'audio
          user.audioTrack?.stop()
          // Se désabonner de l'audio
          await agoraClient.unsubscribe(user, mediaType)
          console.log("Unsubscribed from user's audio:", user.uid)
        } catch (error) {
          console.error("Error unsubscribing from user audio:", error)
        }
      }
    }

    // Ajouter les écouteurs d'événements
    agoraClient.on("user-published", handleUserPublished)
    agoraClient.on("user-unpublished", handleUserUnpublished)

    // Nettoyer les écouteurs
    return () => {
      agoraClient.off("user-published", handleUserPublished)
      agoraClient.off("user-unpublished", handleUserUnpublished)
    }
  }, [enabled, agoraClient])

  // Vérifier les permissions du microphone
  const checkPermission = useCallback(async () => {
    if (!enabled || !mountedRef.current) return true

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())
      if (mountedRef.current) {
        setHasPermission(true)
      }
      return true
    } catch (error) {
      console.error('Microphone permission error:', error)
      if (mountedRef.current) {
        setHasPermission(false)
      }
      return false
    }
  }, [enabled])

  // Publier l'audio local
  const publishAudio = useCallback(async () => {
    if (!mountedRef.current || !enabled || localAudioTrackRef.current) return

    try {
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack()
      if (!mountedRef.current) {
        audioTrack.close()
        return
      }

      await agoraClient.publish(audioTrack)
      console.log("Published local audio track")
      
      if (mountedRef.current) {
        localAudioTrackRef.current = audioTrack
      } else {
        audioTrack.close()
      }
    } catch (error) {
      console.error('Error publishing audio:', error)
    }
  }, [enabled, agoraClient])

  // Dépublier l'audio local
  const unpublishAudio = useCallback(async () => {
    if (!localAudioTrackRef.current) return

    try {
      await agoraClient.unpublish(localAudioTrackRef.current)
      localAudioTrackRef.current.stop()
      localAudioTrackRef.current.close()
      localAudioTrackRef.current = null
      console.log("Unpublished local audio track")
    } catch (error) {
      console.error('Error unpublishing audio:', error)
    }
  }, [agoraClient])

  // Initialiser le chat vocal
  const initializeVoiceChat = useCallback(async () => {
    if (!enabled || !appId || !channel || !uid || !mountedRef.current || initializingRef.current) {
      return
    }

    try {
      initializingRef.current = true

      // Se connecter au channel
      await agoraClient.join(appId, channel, null, uid)
      console.log("Joined Agora channel:", channel)
      
      // Si host ou speaker, publier l'audio
      if (canPublishRef.current) {
        await publishAudio()
      }
      
      if (mountedRef.current) {
        setIsConnected(true)
        setError(null)
      }
    } catch (error) {
      console.error('Error joining channel:', error)
      if (mountedRef.current) {
        setError('Failed to join voice channel')
        setIsConnected(false)
      }
    } finally {
      initializingRef.current = false
    }
  }, [enabled, appId, channel, uid, agoraClient, publishAudio])

  // Demander la permission du microphone
  const requestPermission = useCallback(async () => {
    if (!enabled || !mountedRef.current) return false

    const granted = await checkPermission()
    if (granted && mountedRef.current) {
      try {
        await initializeVoiceChat()
      } catch (error) {
        console.error('Error initializing voice chat:', error)
      }
    }
    return granted
  }, [enabled, checkPermission, initializeVoiceChat])

  // Gérer le mute/unmute
  const toggleMute = useCallback(() => {
    if (!enabled || !localAudioTrackRef.current) return

    const newMutedState = !isMuted
    localAudioTrackRef.current.setEnabled(!newMutedState)
    setIsMuted(newMutedState)
    console.log("Local audio track muted:", newMutedState)
  }, [enabled, isMuted])

  // Mettre à jour le statut de publication quand le rôle change
  useEffect(() => {
    canPublishRef.current = isHost || isSpeaker
    
    if (canPublishRef.current && isConnected) {
      publishAudio()
    } else if (!canPublishRef.current && localAudioTrackRef.current) {
      unpublishAudio()
    }
  }, [isHost, isSpeaker, isConnected, publishAudio, unpublishAudio])

  // Nettoyer lors du démontage
  useEffect(() => {
    if (!enabled) return

    return () => {
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop()
        localAudioTrackRef.current.close()
        localAudioTrackRef.current = null
      }
      agoraClient.leave()
      console.log("Left Agora channel")
    }
  }, [enabled, agoraClient])

  return {
    agoraClient,
    isConnected,
    hasPermission,
    isMuted,
    error,
    toggleMute,
    requestPermission
  }
}
