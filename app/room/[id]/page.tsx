'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Mic, MicOff, PhoneOff } from 'lucide-react'
import { useVoiceChat } from '@/hooks/useVoiceChat'

interface User {
  id: string
  name: string
  avatarUrl: string | null
}

interface Room {
  id: string
  name: string
  users: User[]
}

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const [room, setRoom] = useState<Room | null>(null)
  const userId = useMemo(() => 'user-' + Math.random().toString(36).substr(2, 9), [])
  const { users: voiceUsers, isMuted, toggleMute, leaveChannel, permissionError } = useVoiceChat(
    params.id as string,
    userId
  )

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const response = await fetch(`/api/rooms/${params.id}`)
        if (!response.ok) throw new Error('Failed to fetch room')
        const data = await response.json()
        setRoom(data)
      } catch (error) {
        console.error('Error fetching room:', error)
      }
    }

    if (params.id) {
      fetchRoom()
    }
  }, [params.id])

  const handleLeaveRoom = async () => {
    try {
      await leaveChannel()
      router.push('/')
    } catch (error) {
      console.error('Error leaving room:', error)
    }
  }

  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        {permissionError && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
            {permissionError}
          </div>
        )}
        <p className="text-lg">Loading room...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold">{room.name}</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className={isMuted ? 'text-destructive' : ''}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            <Button 
              variant="destructive" 
              size="icon"
              onClick={handleLeaveRoom}
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {room.users.map((user) => (
              <div
                key={user.id}
                className="flex flex-col items-center p-4 bg-card rounded-lg"
              >
                <div className="relative w-24 h-24 mb-2">
                  {user.avatarUrl ? (
                    <Image
                      src={user.avatarUrl}
                      alt={user.name}
                      fill
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-muted flex items-center justify-center">
                      <span className="text-2xl">{user.name[0]}</span>
                    </div>
                  )}
                  {voiceUsers.some(u => u.uid === user.id) && (
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-background" />
                  )}
                </div>
                <p className="text-sm font-medium">{user.name}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
