import { Server as NetServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { NextApiResponse } from 'next'
import { prisma } from './prisma'

export interface SocketServer extends NetServer {
  io?: SocketIOServer
}

export type ResponseWithSocket = Omit<NextApiResponse, 'socket'> & {
  socket: {
    server: SocketServer
  }
}

export const SOCKET_PATH = '/api/socketio'

interface SpeakerRequestPayload {
  roomId: string
  userId: string
}

interface RoomEventPayload {
  roomId: string
}

interface InitialStatePayload {
  speakers: any[]
  waitlist: any[]
}

interface WaitlistUpdatedPayload {
  waitlist: any[]
  timestamp: number
}

interface SpeakersUpdatedPayload {
  speakers: any[]
  timestamp: number
}

interface UpdateConfirmedPayload {
  type: string
  userId: string
  roomId: string
  timestamp: number
}

export const socketConfig = {
  path: SOCKET_PATH,
  addTrailingSlash: false,
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
}

export function getSocketIO(server: SocketServer) {
  if (!server.io) {
    console.log('Initializing Socket.IO server...')
    server.io = new SocketIOServer(server, socketConfig)
  }
  return server.io
}

export async function handleRoomEvents(io: SocketIOServer, socket: any) {
  console.log('Client connected:', socket.id)

  socket.on('join_room', async ({ roomId }: RoomEventPayload) => {
    socket.join(roomId)
    console.log(`Socket ${socket.id} joined room ${roomId}`)

    const [speakers, waitlist] = await Promise.all([
      (prisma as any).speaker.findMany({
        where: { roomId },
        include: { user: true },
        orderBy: { position: 'asc' },
      }),
      prisma.waitlist.findMany({
        where: { roomId },
        include: { user: true },
        orderBy: { position: 'asc' },
      }),
    ])

    socket.emit('INITIAL_STATE', {
      speakers,
      waitlist,
    } as InitialStatePayload)
  })

  socket.on('SPEAKER_REQUEST', async ({ roomId, userId }: SpeakerRequestPayload) => {
    try {
      const waitlistCount = await prisma.waitlist.count({
        where: { roomId },
      })

      await prisma.waitlist.create({
        data: {
          roomId,
          userId,
          position: waitlistCount + 1,
        },
      })

      const updatedWaitlist = await prisma.waitlist.findMany({
        where: { roomId },
        include: { user: true },
        orderBy: { position: 'asc' },
      })

      io.to(roomId).emit('WAITLIST_UPDATED', { waitlist: updatedWaitlist, timestamp: Date.now() } as WaitlistUpdatedPayload)
    } catch (error) {
      console.error('Error handling speaker request:', error)
    }
  })

  socket.on('SPEAKER_ACCEPTED', async ({ roomId, userId }: SpeakerRequestPayload) => {
    try {
      const speakerCount = await (prisma as any).speaker.count({
        where: { roomId },
      })

      await (prisma as any).speaker.create({
        data: {
          roomId,
          userId,
          position: speakerCount + 1,
        },
      })

      await prisma.waitlist.delete({
        where: {
          roomId_userId: {
            roomId,
            userId,
          },
        },
      })

      const [updatedSpeakers, updatedWaitlist] = await Promise.all([
        (prisma as any).speaker.findMany({
          where: { roomId },
          include: { user: true },
          orderBy: { position: 'asc' },
        }),
        (prisma as any).waitlist.findMany({
          where: { roomId },
          include: { user: true },
          orderBy: { position: 'asc' },
        }),
      ])

      // D'abord envoyer l'événement d'acceptation
      io.to(roomId).emit('SPEAKER_ACCEPTED', { userId, roomId })

      // Ensuite envoyer les mises à jour des listes
      io.to(roomId).emit('SPEAKERS_UPDATED', { 
        speakers: updatedSpeakers,
        timestamp: Date.now() 
      } as SpeakersUpdatedPayload)
      
      io.to(roomId).emit('WAITLIST_UPDATED', { 
        waitlist: updatedWaitlist,
        timestamp: Date.now()
      } as WaitlistUpdatedPayload)

      // Confirmer la mise à jour au client
      socket.emit('UPDATE_CONFIRMED', {
        type: 'SPEAKER_ACCEPTED',
        userId,
        roomId,
        timestamp: Date.now()
      } as UpdateConfirmedPayload)
    } catch (error) {
      console.error('Error accepting speaker:', error)
    }
  })

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
  })
}
