import { useState, useEffect, useCallback, useMemo } from 'react'
import { IAgoraRTCClient } from 'agora-rtc-sdk-ng'
import { useRoomWebSocket } from './useRoomWebSocket'

interface Speaker {
  id: string
  position: number
  userId: string
  userName: string
  avatarUrl?: string
  isMuted: boolean
}

interface WaitlistUser {
  id: string
  userId: string
  userName: string
  avatarUrl?: string
  position: number
  requestedAt: Date
}

interface UseSpeakersProps {
  roomId: string
  userId: string
  userName?: string
  userAvatar?: string
  isCreator?: boolean
  agoraClient?: IAgoraRTCClient
}

export function useSpeakers({ 
  roomId, 
  userId, 
  userName,
  userAvatar,
  isCreator, 
  agoraClient 
}: UseSpeakersProps) {
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [waitlist, setWaitlist] = useState<WaitlistUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Charger les speakers
  const loadSpeakersAndWaitlist = useCallback(async () => {
    try {
      const speakersRes = await fetch(`/api/rooms/${roomId}/speakers`)
      
      if (!speakersRes.ok) {
        throw new Error('Failed to load speakers')
      }

      const speakersData = await speakersRes.json()
      setSpeakers(speakersData)
      
      // La waitlist sera mise à jour via Socket.IO
    } catch (error) {
      console.error('Error loading speakers:', error)
      setError('Failed to load speakers')
    }
  }, [roomId])

  const handleSpeakerAccepted = useCallback((speaker: Speaker) => {
    setSpeakers(prev => [...prev, speaker])
    setWaitlist(prev => prev.filter(u => (u as unknown as WaitlistUser).userId !== (speaker as unknown as Speaker).userId))
  }, [])

  const handleSpeakerRemoved = useCallback((speakerId: string) => {
    setSpeakers(prev => prev.filter(s => s.userId !== speakerId))
  }, [])

  // Gérer les mises à jour via Socket.IO
  const {
    onSpeakerAdded,
    onSpeakerRemoved,
    onSpeakerMuted,
    onWaitlistUpdated,
  } = useMemo(() => ({
    onSpeakerAdded: handleSpeakerAccepted,
    onSpeakerRemoved: handleSpeakerRemoved,
    onSpeakerMuted: () => loadSpeakersAndWaitlist(),
    onWaitlistUpdated: (newWaitlist) => {
      setWaitlist(newWaitlist)
    },
  }), [handleSpeakerAccepted, handleSpeakerRemoved, loadSpeakersAndWaitlist])

  // Initialiser le WebSocket
  const { sendMessage, socket } = useRoomWebSocket({
    roomId,
    onSpeakerAdded,
    onSpeakerRemoved,
    onSpeakerMuted,
    onWaitlistUpdated
  })

  // Charger les données initiales
  useEffect(() => {
    loadSpeakersAndWaitlist()
  }, [loadSpeakersAndWaitlist])

  // Demander à parler
  const requestToSpeak = useCallback(async () => {
    if (!userId || !userName || !userAvatar) {
      setError('User information is missing')
      return
    }

    try {
      // La demande sera gérée via Socket.IO
      socket?.emit('SPEAKER_REQUEST', {
        roomId,
        userId,
        userName,
        userAvatar
      })
    } catch (error) {
      console.error('Error requesting to speak:', error)
      setError('Failed to request speaking permission')
    }
  }, [roomId, userId, userName, userAvatar, socket])

  // Accepter un speaker (créateur uniquement)
  const acceptSpeaker = async (speakerId: string) => {
    if (!isCreator) return

    try {
      const res = await fetch(`/api/rooms/${roomId}/speakers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: speakerId })
      })

      if (!res.ok) {
        throw new Error('Failed to accept speaker')
      }

      const data = await res.json()
      sendMessage('SPEAKER_ADDED', data)

      // Mettre à jour Agora pour le nouvel utilisateur
      if (agoraClient) {
        await agoraClient.setClientRole('host')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept speaker')
    }
  }

  // Supprimer un speaker (créateur uniquement)
  const removeSpeaker = async (speakerId: string) => {
    if (!isCreator) return

    try {
      const res = await fetch(`/api/rooms/${roomId}/speakers/${speakerId}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        throw new Error('Failed to remove speaker')
      }

      sendMessage('SPEAKER_REMOVED', speakerId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove speaker')
    }
  }

  // Activer/désactiver le micro d'un speaker
  const toggleMute = async (speakerId: string) => {
    try {
      const speaker = speakers.find(s => s.id === speakerId)
      if (!speaker) return

      const res = await fetch(`/api/rooms/${roomId}/speakers/${speakerId}/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isMuted: !speaker.isMuted })
      })

      if (!res.ok) {
        throw new Error('Failed to toggle mute')
      }

      const data = await res.json()
      sendMessage('SPEAKER_MUTED', { speakerId, isMuted: data.isMuted })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle mute')
    }
  }

  return {
    speakers,
    waitlist,
    isLoading,
    error,
    requestToSpeak,
    acceptSpeaker,
    removeSpeaker,
    toggleMute
  }
}
