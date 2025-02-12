import { Server as NetServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { NextApiResponse } from 'next'
import { prisma } from './prisma'

export interface SocketServer extends NetServer {
  io?: SocketIOServer
}

export interface ResponseWithSocket extends NextApiResponse {
  socket: {
    server: SocketServer
  }
}

export const SOCKET_PATH = '/api/socketio'

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

  socket.on('join_room', async (roomId: string) => {
    socket.join(roomId)
    console.log(`Socket ${socket.id} joined room ${roomId}`)

    const [speakers, waitlist] = await Promise.all([
      prisma.speaker.findMany({
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
    })
  })

  socket.on('SPEAKER_REQUEST', async ({ roomId, userId }) => {
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

      io.to(roomId).emit('WAITLIST_UPDATED', updatedWaitlist)
    } catch (error) {
      console.error('Error handling speaker request:', error)
    }
  })

  socket.on('SPEAKER_ACCEPTED', async ({ roomId, userId }) => {
    try {
      const speakerCount = await prisma.speaker.count({
        where: { roomId },
      })

      await prisma.speaker.create({
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
        prisma.speaker.findMany({
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

      io.to(roomId).emit('SPEAKERS_UPDATED', updatedSpeakers)
      io.to(roomId).emit('WAITLIST_UPDATED', updatedWaitlist)
    } catch (error) {
      console.error('Error accepting speaker:', error)
    }
  })

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
  })
}
