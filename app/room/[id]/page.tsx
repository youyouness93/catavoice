'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
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

export default function RoomPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isHost, setIsHost] = useState(false)
  const [isCreator, setIsCreator] = useState(false)
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
      socket.emit('join_room', params.id)
    })

    socket.on('SPEAKER_REQUEST', (requesterId: string) => {
      console.log('New speaker request from:', requesterId)
      setSpeakerRequests(prev => [...prev, requesterId])
    })

    socket.on('SPEAKER_ACCEPTED', ({ userId }: { userId: string }) => {
      console.log('Speaker accepted:', userId)
      // Les mises à jour seront gérées par SPEAKERS_UPDATED et WAITLIST_UPDATED
    })

    socket.on('SPEAKERS_UPDATED', ({ speakers: updatedSpeakers }: { speakers: any[] }) => {
      console.log('Speakers updated:', updatedSpeakers)
      const speakerIds = updatedSpeakers.map(s => s.userId)
      console.log('Setting speakers to:', speakerIds)
      setSpeakers(speakerIds)
      
      // Mettre à jour la room avec les nouvelles informations des utilisateurs
      setRoom(prev => {
        if (!prev) return prev;
        const updatedUsers = [...prev.users];
        updatedSpeakers.forEach(speaker => {
          const userIndex = updatedUsers.findIndex(u => u.id === speaker.userId);
          if (userIndex === -1 && speaker.user) {
            updatedUsers.push({
              id: speaker.userId,
              name: speaker.user.name,
              avatarUrl: speaker.user.avatarUrl
            });
          }
        });
        return {
          ...prev,
          users: updatedUsers
        };
      });
    })

    socket.on('WAITLIST_UPDATED', ({ waitlist: updatedWaitlist }: { waitlist: any[] }) => {
      console.log('Waitlist updated:', updatedWaitlist)
      const waitlistIds = updatedWaitlist.map(w => w.userId)
      console.log('Setting waitlist to:', waitlistIds)
      setSpeakerRequests(waitlistIds)
    })

    socket.on('disconnect', () => {
      console.log('Disconnected from Socket.IO')
      // Tenter de se reconnecter
      socket.connect()
    })

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      // Tenter de se reconnecter
      setTimeout(() => {
        socket.connect()
      }, 1000)
    })

    socket.on('SPEAKER_REMOVED', () => {
      // Recharger la liste des speakers depuis la base de données
      loadSpeakers()
    })

    socketRef.current = socket

    // Nettoyer la connexion socket
    return () => {
      socket.disconnect()
    }
  }, [userId, params.id])

  // Recharger les données quand le socket se reconnecte
  useEffect(() => {
    if (socketRef.current?.connected) {
      loadSpeakers()
    }
  }, [socketRef.current?.connected])

  // Gestion des speakers
  const { speakers: speakersHook, error: speakersError, requestToSpeak: requestToSpeakHook } = useSpeakers({
    roomId: params.id,
    userId: userId || '',
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
    channel: params.id,
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
    if (!params?.id) return

    const fetchRoom = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/rooms/${params.id}`)
        const data = await response.json()

        if (!data) {
          router.push('/')
          return
        }

        setRoom(data)
        setIsHost(data.creatorId === userId)
        
        // Récupérer les speakers depuis la base de données
        loadSpeakers()
      } catch (error) {
        console.error('Error fetching room:', error)
        toast({
          title: "Error",
          description: "Failed to load room data",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchRoom()
  }, [params.id, router, userId, toast])

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

  // Charger les speakers au démarrage et quand nécessaire
  const loadSpeakers = useCallback(async () => {
    if (!params?.id) return;

    try {
      const response = await fetch(`/api/rooms/${params.id}/speakers`)
      if (!response.ok) {
        throw new Error('Failed to load speakers')
      }
      const data = await response.json()
      setSpeakers(data.map((s: any) => s.userId))
    } catch (error) {
      console.error('Error loading speakers:', error)
    }
  }, [params?.id])

  // Retirer un speaker
  const removeSpeaker = useCallback(async (speakerId: string) => {
    if (!isHost || !params?.id) return;

    try {
      // Supprimer le speaker de la base de données
      const response = await fetch(`/api/rooms/${params.id}/speakers`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: speakerId }),
      })

      if (!response.ok) {
        throw new Error('Failed to remove speaker')
      }

      // Émettre l'événement socket pour informer les autres utilisateurs
      socketRef.current?.emit('REMOVE_SPEAKER', {
        roomId: params.id,
        speakerId,
      })

      // Recharger la liste des speakers
      loadSpeakers()

      toast({
        title: "Speaker retiré",
        description: "L'utilisateur ne peut plus parler",
      })
    } catch (error) {
      console.error('Error removing speaker:', error)
      toast({
        title: "Erreur",
        description: "Impossible de retirer le speaker",
        variant: "destructive",
      })
    }
  }, [isHost, params?.id, toast, loadSpeakers])

  // Accepter un speaker
  const acceptSpeaker = useCallback(async (speakerId: string) => {
    if (!params?.id) return;
    
    try {
      // Créer le speaker dans la base de données
      const response = await fetch(`/api/rooms/${params.id}/speakers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: speakerId }),
      })

      if (!response.ok) {
        throw new Error('Failed to add speaker')
      }

      // Émettre l'événement socket
      socketRef.current?.emit('ACCEPT_SPEAKER', {
        roomId: params.id,
        speakerId,
      })

      // Recharger la liste des speakers
      loadSpeakers()
      
      // Mettre à jour les demandes
      setSpeakerRequests(prev => prev.filter(id => id !== speakerId))

      toast({
        title: "Speaker accepté",
        description: "L'utilisateur peut maintenant parler",
      })
    } catch (error) {
      console.error('Error accepting speaker:', error)
      toast({
        title: "Erreur",
        description: "Impossible d'accepter le speaker",
        variant: "destructive",
      })
    }
  }, [params?.id, toast, loadSpeakers])

  // Gérer les demandes de parole
  const requestToSpeak = useCallback(async () => {
    if (!userId || !socketRef.current || !params?.id) return;

    // Mettre à jour le state local immédiatement
    setSpeakerRequests(prev => [...prev, userId])
    
    // Envoyer la demande via socket
    socketRef.current.emit('REQUEST_TO_SPEAK', { roomId: params.id, userId })
    
    toast({
      title: "Demande envoyée",
      description: "Votre demande de parole a été envoyée au host",
    })
  }, [userId, params?.id, toast])

  // Charger les speakers au démarrage
  useEffect(() => {
    loadSpeakers()
  }, [loadSpeakers])

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
      
      {/* Main content */}
      <main className="flex-1 container py-6">
        <Card className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-[60vh]">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            room && (
              <div className="flex flex-col h-screen">
                {/* Header avec les boutons */}
                <div className="flex items-center justify-between p-4 border-b">
                  <h1 className="text-2xl font-bold">{room.name}</h1>
                  <div className="flex items-center gap-4">
                    {/* Bouton Mute pour host et speakers */}
                    {(isHost || speakers.includes(userId || '')) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleMute}
                        className={isMuted ? 'text-destructive' : ''}
                      >
                        {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                      </Button>
                    )}
                    
                    {/* Bouton Request to Speak pour les autres */}
                    {!isHost && !speakers.includes(userId || '') && (
                      <Button
                        onClick={requestToSpeak}
                        disabled={speakerRequests.includes(userId || '')}
                        variant={speakerRequests.includes(userId || '') ? "secondary" : "default"}
                        className="min-w-[150px]"
                      >
                        {speakerRequests.includes(userId || '') ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Pending...
                          </>
                        ) : (
                          'Request to Speak'
                        )}
                      </Button>
                    )}
                    
                    {/* Bouton Leave Room */}
                    <Button
                      variant="destructive"
                      onClick={handleLeaveRoom}
                    >
                      Leave Room
                    </Button>
                  </div>
                </div>

                {/* Contenu principal */}
                <div className="flex-1 overflow-hidden">
                  <SpeakersPanel
                    isCreator={isHost}
                    hostId={room.creatorId}
                    hostName={room.users.find(u => u.id === room.creatorId)?.name || 'Host'}
                    hostAvatar={room.users.find(u => u.id === room.creatorId)?.avatarUrl}
                    speakers={speakers}
                    speakerRequests={speakerRequests}
                    currentUserId={userId}
                    roomId={room.id}
                    users={room.users}
                    onRequestToSpeak={requestToSpeak}
                    onAcceptSpeaker={acceptSpeaker}
                    onRemoveSpeaker={removeSpeaker}
                    onToggleMute={toggleMute}
                    key={`${speakers.join(',')}-${speakerRequests.join(',')}`} // Forcer le re-render
                  />
                </div>
              </div>
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
