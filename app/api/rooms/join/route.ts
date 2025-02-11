import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const { roomId, userName, avatarUrl } = await req.json()

    // Create user
    const user = await prisma.user.create({
      data: {
        name: userName,
        avatarUrl,
        rooms: {
          connect: { id: roomId },
        },
      },
    })

    // Get updated room
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        users: true,
      },
    })

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ room, user })
  } catch (error) {
    console.error('Error joining room:', error)
    return NextResponse.json(
      { error: 'Error joining room' },
      { status: 500 }
    )
  }
}
