import { useState, useEffect, useCallback } from 'react'
import { IAgoraRTCClient } from 'agora-rtc-sdk-ng'
import { useRoomWebSocket } from './useRoomWebSocket'
import { useToast } from '@/components/ui/use-toast'

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
  isCreator = false, 
  agoraClient 
}: UseSpeakersProps) {
  const { toast } = useToast()
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [waitlist, setWaitlist] = useState<WaitlistUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Charger les speakers
  const loadSpeakers = useCallback(async () => {
    try {
      const speakersRes = await fetch(`/api/rooms/${roomId}/speakers`)

      if (!speakersRes.ok) {
        throw new Error('Failed to load speakers')
      }

      const speakersData = await speakersRes.json()

      setSpeakers(speakersData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }, [roomId])

  // Initialiser le WebSocket
  const { socket, sendMessage } = useRoomWebSocket({
    roomId,
    onSpeakerAdded: (speaker) => {
      setSpeakers(prev => [...prev, speaker as unknown as Speaker] as Speaker[])
      setWaitlist(prev => prev.filter(u => (u as unknown as WaitlistUser).userId !== (speaker as unknown as Speaker).userId))
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
    loadSpeakers()
  }, [loadSpeakers])

  // Demander à parler
  const requestToSpeak = useCallback(async () => {
    if (!socket || !roomId || !userId) return;

    try {
      // Émettre directement via socket.io
      socket.emit('SPEAKER_REQUEST', { roomId, userId });
      
      toast({
        title: 'Demande envoyée',
        description: 'Votre demande a été envoyée au host',
      });
    } catch (error) {
      console.error('Error requesting to speak:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de faire la demande',
        variant: 'destructive',
      });
    }
  }, [roomId, userId, socket, toast]);

  // Accepter un speaker (créateur uniquement)
  const acceptSpeaker = useCallback(async (speakerId: string) => {
    if (!socket || !roomId) return;

    try {
      // Émettre directement via socket.io
      socket.emit('SPEAKER_ACCEPTED', { roomId, userId: speakerId });
      
      toast({
        title: 'Speaker accepté',
        description: 'L\'utilisateur peut maintenant parler',
      });
    } catch (error) {
      console.error('Error accepting speaker:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'accepter le speaker',
        variant: 'destructive',
      });
    }
  }, [roomId, socket, toast]);

  // Supprimer un speaker (créateur uniquement)
  const removeSpeaker = useCallback(async (speakerId: string) => {
    if (!socket || !roomId || !isCreator) return;

    try {
      // Émettre directement via socket.io
      socket.emit('REMOVE_SPEAKER', { roomId, speakerId });
      
      toast({
        title: 'Speaker retiré',
        description: 'L\'utilisateur ne peut plus parler',
      });
    } catch (error) {
      console.error('Error removing speaker:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de retirer le speaker',
        variant: 'destructive',
      });
    }
  }, [roomId, isCreator, socket, toast]);

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
