import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log('Fetching speakers for room:', params.id)
    const speakers = await prisma.speaker.findMany({
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
    
    console.log('Found speakers:', speakers)
    return NextResponse.json(speakers)
  } catch (error) {
    console.error('Error fetching speakers:', error)
    return new NextResponse('Error fetching speakers', { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await request.json()
    console.log('Adding speaker to room:', params.id, 'userId:', userId)

    const speakerCount = await prisma.speaker.count({
      where: { roomId: params.id },
    })

    const speaker = await prisma.speaker.create({
      data: {
        roomId: params.id,
        userId,
        position: speakerCount + 1,
      },
      include: {
        user: true,
      },
    })

    console.log('Created speaker:', speaker)
    return NextResponse.json(speaker)
  } catch (error) {
    console.error('Error creating speaker:', error)
    return new NextResponse('Error creating speaker', { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await request.json()
    console.log('Removing speaker from room:', params.id, 'userId:', userId)

    await prisma.speaker.delete({
      where: {
        roomId_userId: {
          roomId: params.id,
          userId,
        },
      },
    })

    console.log('Speaker removed successfully')
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error removing speaker:', error)
    return new NextResponse('Error removing speaker', { status: 500 })
  }
}
