"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Image from "next/image"

interface Avatar {
  id: number
  src: string
  alt: string
}

const avatars: Avatar[] = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-vLvBcD90A4t8NdN9mwKNSfgIyeY1fl.png", // Using same image for demo, would need unique avatars
  alt: `Avatar option ${i + 1}`,
}))

export default function AvatarSelection() {
  const [selectedAvatar, setSelectedAvatar] = useState<number | null>(3)
  const [displayName, setDisplayName] = useState("Dennis Ivy")
  const [roomName, setRoomName] = useState("dev-mee")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle room entry logic here
    console.log({
      avatarId: selectedAvatar,
      displayName,
      roomName,
    })
  }

  return (
    <div className="w-full max-w-md mx-auto p-6 space-y-6 bg-zinc-900 rounded-lg">
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-white">Select An Avatar:</h2>

        <div className="grid grid-cols-4 gap-4 md:grid-cols-8">
          {avatars.map((avatar) => (
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

        <form onSubmit={handleSubmit} className="space-y-4">
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
            Enter Room
          </Button>
        </form>
      </div>
    </div>
  )
}

