import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

interface UseRoomWebSocketProps {
  roomId: string
  onSpeakerAdded?: (speakers: any[]) => void
  onSpeakerRemoved?: (speakerId: string) => void
  onSpeakerMuted?: (speakerId: string, isMuted: boolean) => void
  onWaitlistUpdated?: (waitlist: any[]) => void
}

export function useRoomWebSocket({
  roomId,
  onSpeakerAdded,
  onSpeakerRemoved,
  onSpeakerMuted,
  onWaitlistUpdated
}: UseRoomWebSocketProps) {
  const socketRef = useRef<Socket | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 3

  useEffect(() => {
    let mounted = true

    const connectSocket = () => {
      if (!mounted || reconnectAttempts.current >= maxReconnectAttempts) return

      // Nettoyer la connexion existante si elle existe
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }

      // Initialiser Socket.IO avec des paramètres de reconnexion
      const socket = io('', {
        path: '/api/socket',
        addTrailingSlash: false,
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      })

      socketRef.current = socket

      socket.on('connect', () => {
        console.log('Connected to Socket.IO')
        reconnectAttempts.current = 0
        if (mounted && roomId) {
          socket.emit('join_room', roomId)
        }
      })

      socket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error)
        reconnectAttempts.current++
        if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.error('Max reconnection attempts reached')
          socket.disconnect()
        }
      })

      socket.on('disconnect', (reason) => {
        console.log('Disconnected from Socket.IO:', reason)
        if (reason === 'io server disconnect') {
          // Le serveur a forcé la déconnexion
          socket.connect()
        }
      })

      // Gérer les événements
      socket.on('INITIAL_STATE', (data) => {
        if (!mounted) return
        console.log('Initial state received:', data)
        onSpeakerAdded?.(data.speakers)
        onWaitlistUpdated?.(data.waitlist)
      })

      socket.on('SPEAKERS_UPDATED', (speakers) => {
        if (!mounted) return
        console.log('Speakers updated:', speakers)
        onSpeakerAdded?.(speakers)
      })

      socket.on('SPEAKER_REMOVED', (speakerId) => {
        if (!mounted) return
        console.log('Speaker removed:', speakerId)
        onSpeakerRemoved?.(speakerId)
      })

      socket.on('SPEAKER_MUTED', (data) => {
        if (!mounted) return
        console.log('Speaker muted:', data)
        onSpeakerMuted?.(data.speakerId, data.isMuted)
      })

      socket.on('WAITLIST_UPDATED', (waitlist) => {
        if (!mounted) return
        console.log('Waitlist updated:', waitlist)
        onWaitlistUpdated?.(waitlist)
      })

      socket.on('error', (error) => {
        console.error('Socket error:', error)
      })
    }

    connectSocket()

    // Cleanup
    return () => {
      mounted = false
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [roomId, onSpeakerAdded, onSpeakerRemoved, onSpeakerMuted, onWaitlistUpdated])

  const sendMessage = useCallback((type: string, payload: any) => {
    if (!socketRef.current?.connected) {
      console.warn('Socket.IO not connected, message not sent:', type)
      return
    }

    try {
      console.log('Sending message:', type, { roomId, ...payload })
      socketRef.current.emit(type, { roomId, ...payload })
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }, [roomId])

  return { sendMessage }
}
