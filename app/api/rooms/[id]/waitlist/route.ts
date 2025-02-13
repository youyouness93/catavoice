import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log('Fetching waitlist for room:', params.id)
    const waitlist = await prisma.waitlist.findMany({
      where: {
        roomId: params.id,
      },
      include: {
        user: true,
      },
      orderBy: {
        position: 'asc',
      },
    })
    
    console.log('Found waitlist:', waitlist)
    return NextResponse.json(waitlist)
  } catch (error) {
    console.error('Error fetching waitlist:', error)
    return new NextResponse('Error fetching waitlist', { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await request.json()
    console.log('Adding user to waitlist:', userId, 'in room:', params.id)

    // Vérifier si l'utilisateur est déjà dans la waitlist
    const existingRequest = await prisma.waitlist.findUnique({
      where: {
        roomId_userId: {
          roomId: params.id,
          userId,
        },
      },
    })

    if (existingRequest) {
      return new NextResponse('User already in waitlist', { status: 400 })
    }

    // Obtenir la position actuelle la plus élevée
    const waitlistCount = await prisma.waitlist.count({
      where: { roomId: params.id },
    })

    // Ajouter l'utilisateur à la waitlist
    const waitlistItem = await prisma.waitlist.create({
      data: {
        roomId: params.id,
        userId,
        position: waitlistCount + 1,
      },
      include: {
        user: true,
      },
    })

    console.log('Added to waitlist:', waitlistItem)
    return NextResponse.json(waitlistItem)
  } catch (error) {
    console.error('Error adding to waitlist:', error)
    return new NextResponse('Error adding to waitlist', { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await request.json()
    console.log('Removing from waitlist:', userId, 'in room:', params.id)

    await prisma.waitlist.delete({
      where: {
        roomId_userId: {
          roomId: params.id,
          userId,
        },
      },
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error removing from waitlist:', error)
    return new NextResponse('Error removing from waitlist', { status: 500 })
  }
}
