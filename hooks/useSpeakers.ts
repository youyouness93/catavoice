import { useState, useEffect, useCallback } from 'react'
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
  userName: string
  userAvatar?: string
  isCreator: boolean
  agoraClient: IAgoraRTCClient
  enabled?: boolean
}

export function useSpeakers({ 
  roomId, 
  userId, 
  userName,
  userAvatar,
  isCreator, 
  agoraClient,
  enabled = true
}: UseSpeakersProps) {
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [waitlist, setWaitlist] = useState<WaitlistUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Charger les speakers et la liste d'attente
  const loadSpeakersAndWaitlist = useCallback(async () => {
    try {
      const [speakersRes, waitlistRes] = await Promise.all([
        fetch(`/api/rooms/${roomId}/speakers`),
        fetch(`/api/rooms/${roomId}/waitlist`)
      ])

      if (!speakersRes.ok || !waitlistRes.ok) {
        throw new Error('Failed to load speakers or waitlist')
      }

      const [speakersData, waitlistData] = await Promise.all([
        speakersRes.json(),
        waitlistRes.json()
      ])

      setSpeakers(speakersData)
      setWaitlist(waitlistData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [roomId])

  // Initialiser le WebSocket
  const { sendMessage } = useRoomWebSocket({
    roomId,
    onSpeakerAdded: (speaker) => {
      setSpeakers(prev => [...prev, speaker])
      setWaitlist(prev => prev.filter(u => u.userId !== speaker.userId))
    },
    onSpeakerRemoved: (speakerId) => {
      setSpeakers(prev => prev.filter(s => s.id !== speakerId))
    },
    onSpeakerMuted: (speakerId, isMuted) => {
      setSpeakers(prev => prev.map(s => 
        s.id === speakerId ? { ...s, isMuted } : s
      ))
    },
    onWaitlistUpdated: (newWaitlist) => {
      setWaitlist(newWaitlist)
    }
  })

  // Charger les données initiales
  useEffect(() => {
    loadSpeakersAndWaitlist()
  }, [loadSpeakersAndWaitlist])

  // Demander à parler
  const requestToSpeak = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/waitlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          userName,
          avatarUrl: userAvatar
        })
      })

      if (!res.ok) {
        throw new Error('Failed to request to speak')
      }

      await loadSpeakersAndWaitlist()
    } catch (error) {
      console.error('Error requesting to speak:', error)
      setError('Failed to request to speak')
    }
  }, [roomId, userId, userName, userAvatar, loadSpeakersAndWaitlist])

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
      await agoraClient.setClientRole('host')
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
