import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const { roomId, userName, avatarUrl } = await req.json()

    // Vérifier si la room existe
    const existingRoom = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        users: true,
      },
    })

    if (!existingRoom) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      )
    }

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

    // Get updated room with the new user
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        users: true,
        speakers: {
          include: {
            user: true,
          },
        },
        waitlist: {
          include: {
            user: true,
          },
        },
      },
    })

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found after joining' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      room,
      user: {
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
      }
    })
  } catch (error: any) {
    console.error('Error joining room:', error)
    
    // Si l'erreur est due à une contrainte unique (e.g., nom d'utilisateur déjà pris)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Username already taken in this room' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Error joining room' },
      { status: 500 }
    )
  }
}
