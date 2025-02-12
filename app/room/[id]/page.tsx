'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useVoiceChat } from '@/hooks/useVoiceChat'
import { useSpeakers } from '@/hooks/useSpeakers'
import { SpeakersPanel } from '@/components/room/SpeakersPanel'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Mic, MicOff } from 'lucide-react'
import io from 'socket.io-client'

interface Room {
  id: string
  name: string
  creatorId: string
  users: User[]
}

interface User {
  id: string
  name: string
  avatarUrl?: string
}

export default function RoomPage() {
  const params = useParams()
  const roomId = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : ''
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [isCreator, setIsCreator] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [room, setRoom] = useState<Room | null>(null)
  const [speakers, setSpeakers] = useState<string[]>([])
  const [speakerRequests, setSpeakerRequests] = useState<string[]>([])
  const { toast } = useToast()
  const socketRef = useRef<any>(null)

  // Charger les informations de l'utilisateur depuis le localStorage
  useEffect(() => {
    const storedUserId = localStorage.getItem('userId')
    const storedUserName = localStorage.getItem('userName')
    const storedUserAvatar = localStorage.getItem('userAvatar')

    if (!storedUserId || !storedUserName) {
      router.push('/')
      return
    }

    setUserId(storedUserId)
    setUserName(storedUserName)
    setUserAvatar(storedUserAvatar)
  }, [router])

  // Initialiser Socket.IO
  useEffect(() => {
    if (!userId) return

    const socket = io('', {
      path: '/api/socket',
    })

    socket.on('connect', () => {
      console.log('Connected to Socket.IO')
      socket.emit('join_room', roomId)
    })

    socket.on('SPEAKER_REQUEST', (requesterId: string) => {
      console.log('New speaker request from:', requesterId)
      setSpeakerRequests(prev => [...prev, requesterId])
    })

    socket.on('SPEAKER_ACCEPTED', (speakerId: string) => {
      console.log('Speaker accepted:', speakerId)
      setSpeakers(prev => [...prev, speakerId])
      setSpeakerRequests(prev => prev.filter(id => id !== speakerId))
    })

    socket.on('SPEAKER_REMOVED', (speakerId: string) => {
      console.log('Speaker removed:', speakerId)
      setSpeakers(prev => prev.filter(id => id !== speakerId))
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
    }
  }, [userId, roomId])

  // Gestion des speakers
  const { speakers: speakersHook, speakersError, requestToSpeak: requestToSpeakHook } = useSpeakers({
    roomId,
    userId: userId || '',
    enabled: !!userId
  })

  // Voice chat
  const {
    agoraClient,
    isConnected,
    hasPermission,
    requestPermission,
    isMuted,
    toggleMute
  } = useVoiceChat({
    appId: process.env.NEXT_PUBLIC_AGORA_APP_ID || '',
    channel: roomId,
    uid: userId || '',
    isHost,
    isSpeaker: speakers.includes(userId || ''),
    enabled: !!userId
  })

  // Initialiser automatiquement Agora quand userId est disponible
  useEffect(() => {
    if (userId && !isConnected && !hasPermission) {
      requestPermission()
    }
  }, [userId, isConnected, hasPermission, requestPermission])

  // Vérifier si l'utilisateur est le créateur de la room
  useEffect(() => {
    const checkCreator = async () => {
      if (!userId) return

      try {
        const res = await fetch(`/api/rooms/${roomId}`)
        if (!res.ok) throw new Error('Failed to fetch room')
        const room = await res.json()
        setRoom(room)
        setIsCreator(room.creatorId === userId)
        setIsHost(room.creatorId === userId)
      } catch (error) {
        console.error('Error checking creator:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (userId) {
      checkCreator()
    }
  }, [roomId, userId])

  // Gérer les erreurs
  useEffect(() => {
    if (speakersError) {
      toast({
        title: 'Speakers Error',
        description: speakersError,
        variant: 'destructive'
      })
    }
  }, [speakersError, toast])

  // Gérer la demande de permission du microphone
  const handleRequestPermission = async () => {
    const granted = await requestPermission()
    if (granted) {
      toast({
        title: 'Permission Granted',
        description: 'Microphone access has been granted.'
      })
    } else {
      toast({
        title: 'Permission Denied',
        description: 'Please enable microphone access to participate in voice chat.',
        variant: 'destructive'
      })
    }
  }

  const handleLeaveRoom = () => {
    localStorage.removeItem('userId')
    localStorage.removeItem('userName')
    localStorage.removeItem('userAvatar')
    router.push('/')
  }

  // Gérer les demandes de parole
  const requestToSpeak = useCallback(() => {
    if (userId && socketRef.current) {
      socketRef.current.emit('REQUEST_TO_SPEAK', { roomId, userId })
      toast({
        title: "Demande envoyée",
        description: "Votre demande de parole a été envoyée au host",
      })
    }
  }, [userId, roomId, toast])

  // Accepter un speaker (host uniquement)
  const acceptSpeaker = useCallback((speakerId: string) => {
    if (isHost && socketRef.current) {
      socketRef.current.emit('ACCEPT_SPEAKER', { roomId, speakerId })
      toast({
        title: "Speaker accepté",
        description: "L'utilisateur peut maintenant parler",
      })
    }
  }, [isHost, roomId, toast])

  // Retirer un speaker (host uniquement)
  const removeSpeaker = useCallback((speakerId: string) => {
    if (isHost && socketRef.current) {
      socketRef.current.emit('REMOVE_SPEAKER', { roomId, speakerId })
      toast({
        title: "Speaker retiré",
        description: "L'utilisateur ne peut plus parler",
      })
    }
  }, [isHost, roomId, toast])

  if (!userId || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <p className="text-lg">Loading room...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container flex items-center justify-between h-14">
          <h1 className="text-lg font-semibold">{room.name}</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleMute()}
              className={isMuted ? 'text-destructive' : ''}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            <Button variant="outline" onClick={handleLeaveRoom}>
              Leave Room
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 container py-6">
        <Card className="p-6">
          {!hasPermission ? (
            <div className="text-center p-4">
              <p className="mb-4">Microphone access is required to participate in voice chat.</p>
              <Button onClick={handleRequestPermission}>
                Grant Microphone Access
              </Button>
            </div>
          ) : (
            room && (
              <SpeakersPanel
                isCreator={isHost}
                hostId={room.creatorId}
                hostName={room.users.find(u => u.id === room.creatorId)?.name || 'Host'}
                hostAvatar={room.users.find(u => u.id === room.creatorId)?.avatarUrl}
                speakers={speakers}
                speakerRequests={speakerRequests}
                currentUserId={userId}
                roomId={params.id}
                users={room.users}
                onRequestToSpeak={requestToSpeak}
                onAcceptSpeaker={acceptSpeaker}
                onRemoveSpeaker={removeSpeaker}
                onToggleMute={toggleMute}
              />
            )
          )}

          {isConnected && (
            <p className="text-sm text-green-600 mt-4">
              Connected to voice chat
            </p>
          )}
        </Card>
      </main>
    </div>
  )
}
