import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const { name, userName, avatarUrl } = await req.json()

    // Create user
    const user = await prisma.user.create({
      data: {
        name: userName,
        avatarUrl,
      },
    })

    // Create room
    const room = await prisma.room.create({
      data: {
        name,
        creatorId: user.id,  
        users: {
          connect: { id: user.id },
        },
      },
      include: {
        users: true,
      },
    })

    return NextResponse.json({ room, user })
  } catch (error) {
    console.error('Error creating room:', error)
    return NextResponse.json(
      { error: 'Error creating room' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const rooms = await prisma.room.findMany({
      include: {
        users: true,
      },
    })
    return NextResponse.json(rooms)
  } catch (error) {
    console.error('Error fetching rooms:', error)
    return NextResponse.json(
      { error: 'Error fetching rooms' },
      { status: 500 }
    )
  }
}
