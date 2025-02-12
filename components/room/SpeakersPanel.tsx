import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Crown, Mic, MicOff, Users } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

interface SpeakersPanelProps {
  isCreator: boolean
  hostId: string
  hostName: string
  hostAvatar?: string
  speakers: string[]
  speakerRequests: string[]
  currentUserId: string | null
  roomId: string
  users: Array<{ id: string, name: string, avatarUrl?: string }>
  onRequestToSpeak: () => void
  onAcceptSpeaker: (userId: string) => void
  onRemoveSpeaker: (userId: string) => void
  onToggleMute: () => void
}

export function SpeakersPanel({
  isCreator,
  hostId,
  hostName,
  hostAvatar,
  speakers,
  speakerRequests,
  currentUserId,
  roomId,
  users,
  onRequestToSpeak,
  onAcceptSpeaker,
  onRemoveSpeaker,
  onToggleMute
}: SpeakersPanelProps) {
  const isHost = currentUserId === hostId
  const isSpeaker = speakers.includes(currentUserId || '')
  const hasRequestedToSpeak = speakerRequests.includes(currentUserId || '')

  return (
    <Card className="p-6 h-[calc(100vh-2rem)] flex flex-col">
      <div className="space-y-6 flex-1 overflow-hidden">
        {/* Section Host */}
        <div className="relative">
          <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={hostAvatar} />
                  <AvatarFallback>{hostName[0]}</AvatarFallback>
                </Avatar>
                <Crown className="h-5 w-5 text-yellow-500 absolute -top-2 -right-2" />
              </div>
              <div>
                <p className="font-semibold text-lg">{hostName}</p>
                <p className="text-sm text-muted-foreground">Host</p>
              </div>
            </div>
            {isHost && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleMute}
              >
                <Mic className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Section Speakers Grid */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Speakers
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, index) => {
              const speaker = users.find(u => speakers[index] === u.id)
              
              return (
                <Card key={index} className="p-4 flex flex-col items-center justify-center space-y-2">
                  {speaker ? (
                    <>
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={speaker.avatarUrl} />
                        <AvatarFallback>{speaker.name[0]}</AvatarFallback>
                      </Avatar>
                      <p className="text-sm font-medium text-center">{speaker.name}</p>
                      {isHost && speaker.id !== hostId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemoveSpeaker(speaker.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </>
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">Empty</span>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </div>

        {/* Section Demandes (visible uniquement par le host) */}
        {isHost && speakerRequests.length > 0 && (
          <div>
            <Separator className="my-4" />
            <h3 className="font-semibold mb-3">Waiting for Permission</h3>
            <ScrollArea className="h-32">
              <div className="space-y-2">
                {speakerRequests.map((requestId) => {
                  const user = users.find(u => u.id === requestId)
                  if (!user) return null
                  
                  return (
                    <div key={requestId} className="flex items-center justify-between p-2 bg-secondary/20 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatarUrl} />
                          <AvatarFallback>{user.name[0]}</AvatarFallback>
                        </Avatar>
                        <p className="text-sm font-medium">{user.name}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => onAcceptSpeaker(requestId)}
                      >
                        Accept
                      </Button>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Section Tous les utilisateurs */}
        <div>
          <Separator className="my-4" />
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" />
            All Users ({users.length})
          </h3>
          <ScrollArea className="h-48">
            <div className="space-y-2">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/20">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatarUrl} />
                      <AvatarFallback>{user.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.id === hostId ? 'Host' : 
                         speakers.includes(user.id) ? 'Speaker' : 
                         speakerRequests.includes(user.id) ? 'Waiting' : 
                         'Listener'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </Card>
  )
}
