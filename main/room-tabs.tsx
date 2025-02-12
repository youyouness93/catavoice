"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ImagePlus } from "lucide-react"
import Image from "next/image"

const predefinedAvatars = [
  {
    id: 1,
    src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/avatar1.jpg-yYhVSKrhEnxPHAH8ynZgKLxU8zBElB.jpeg",
    alt: "Serious cat avatar",
  },
  {
    id: 2,
    src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/avatar2.jpg-2966FSgePq8DXapeNkCa6aiOLzSQN8.jpeg",
    alt: "3D glasses cat avatar",
  },
  {
    id: 3,
    src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/avatar3.jpg-M9StYgEb647AJ63L9iLa6k0Pf3j0mW.jpeg",
    alt: "Happy cat avatar",
  },
  {
    id: 4,
    src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/avatar4.jpg-cb8yiIVUUNcrfSRJCPXNIwYn7hy8Hf.jpeg",
    alt: "Big eyes cat avatar",
  },
  {
    id: 5,
    src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/avatar5.jpg-smaJHP53Dgf9RHT2n5p2bSnlxGU2Gq.jpeg",
    alt: "Fries cat avatar",
  },
  {
    id: 6,
    src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/avatar6.jpg-ZtZGSYLBYhH3efBuQxNtOCJ3yQ90dJ.jpeg",
    alt: "Robot cat avatar",
  },
]

export default function RoomTabs() {
  const router = useRouter()
  const [selectedAvatar, setSelectedAvatar] = useState<number | null>(null)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState("")
  const [roomName, setRoomName] = useState("")
  const [joinDisplayName, setJoinDisplayName] = useState("")
  const [joinRoomCode, setJoinRoomCode] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setUploadedImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName || !roomName) {
      alert('Please fill in all fields')
      return
    }

    // Déterminer l'URL de l'avatar à utiliser
    const avatarUrl = uploadedImage || 
      (selectedAvatar !== null ? predefinedAvatars[selectedAvatar - 1].src : null)

    try {
      console.log('Creating room...')
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: roomName,
          userName: displayName,
          avatarUrl: avatarUrl,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create room')
      }

      const { room, user } = await response.json()
      console.log('Room created:', { room, user })
      
      // Stocker les informations de l'utilisateur dans le localStorage
      localStorage.setItem('userId', user.id)
      localStorage.setItem('userName', user.name)
      localStorage.setItem('userAvatar', user.avatarUrl || '')
      
      router.push(`/room/${room.id}`)
    } catch (error) {
      console.error('Error creating room:', error)
      alert('Failed to create room. Please try again.')
    }
  }

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinDisplayName || !joinRoomCode) {
      alert('Please fill in all fields')
      return
    }

    try {
      console.log('Joining room...')
      const response = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId: joinRoomCode,
          userName: joinDisplayName,
          avatarUrl: uploadedImage || (selectedAvatar !== null ? predefinedAvatars[selectedAvatar - 1].src : null),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to join room')
      }

      const { room, user } = await response.json()
      console.log('Joined room:', { room, user })

      // Stocker les informations de l'utilisateur dans le localStorage
      localStorage.setItem('userId', user.id)
      localStorage.setItem('userName', user.name)
      localStorage.setItem('userAvatar', user.avatarUrl || '')

      router.push(`/room/${room.id}`)
    } catch (error) {
      console.error('Error joining room:', error)
      alert(error instanceof Error ? error.message : 'Failed to join room. Please check the room code and try again.')
    }
  }

  return (
    <div className="w-full max-w-md mx-auto p-6 space-y-6 bg-zinc-900 rounded-lg">
      <Tabs defaultValue="create" className="space-y-6">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="create">Create Room</TabsTrigger>
          <TabsTrigger value="join">Join Room</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-white">Upload Your Avatar:</h2>

            <div className="flex flex-col items-center gap-4">
              <div
                className="relative w-32 h-32 rounded-full overflow-hidden bg-zinc-800 border-2 border-dashed border-zinc-700 hover:border-zinc-500 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadedImage ? (
                  <Image
                    src={uploadedImage || "/placeholder.svg"}
                    alt="Uploaded avatar"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400">
                    <ImagePlus className="w-8 h-8 mb-2" />
                    <span className="text-sm">Upload Image</span>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="displayName" className="text-sm font-medium text-white">
                  Display Name:
                </label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="roomName" className="text-sm font-medium text-white">
                  Room Name:
                </label>
                <Input
                  id="roomName"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white"
                  required
                />
              </div>

              <Button type="submit" className="w-full bg-zinc-700 hover:bg-zinc-600 text-white">
                Create Room
              </Button>
            </form>
          </div>
        </TabsContent>

        <TabsContent value="join" className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-white">Select An Avatar:</h2>

            <div className="grid grid-cols-3 gap-4">
              {predefinedAvatars.map((avatar) => (
                <button
                  key={avatar.id}
                  onClick={() => setSelectedAvatar(avatar.id)}
                  className={`relative aspect-square rounded-full overflow-hidden border-2 transition-colors ${
                    selectedAvatar === avatar.id ? "border-green-500" : "border-transparent"
                  }`}
                >
                  <Image src={avatar.src || "/placeholder.svg"} alt={avatar.alt} fill className="object-cover" />
                </button>
              ))}
            </div>

            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="joinDisplayName" className="text-sm font-medium text-white">
                  Display Name:
                </label>
                <Input
                  id="joinDisplayName"
                  value={joinDisplayName}
                  onChange={(e) => setJoinDisplayName(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="joinRoomCode" className="text-sm font-medium text-white">
                  Room Code:
                </label>
                <Input
                  id="joinRoomCode"
                  value={joinRoomCode}
                  onChange={(e) => setJoinRoomCode(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white"
                  placeholder="Enter room code..."
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-zinc-700 hover:bg-zinc-600 text-white"
                disabled={!selectedAvatar}
              >
                Join Room
              </Button>
            </form>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
