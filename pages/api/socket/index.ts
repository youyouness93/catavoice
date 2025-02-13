import { Server as NetServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { NextApiRequest } from 'next'
import { NextApiResponseServerIO } from '@/types/socket'
import { prisma } from '@/lib/prisma'

export const config = {
  api: {
    bodyParser: false
  }
}

let io: SocketIOServer | null = null

const ioHandler = (req: NextApiRequest, res: NextApiResponseServerIO) => {
  if (!res.socket.server.io) {
    console.log('Initializing Socket.IO server...')
    
    const httpServer: NetServer = res.socket.server as any
    io = new SocketIOServer(httpServer, {
      path: '/api/socket',
      addTrailingSlash: false,
      pingTimeout: 60000,
      pingInterval: 25000,
    })

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id)

      socket.on('join_room', async (roomId: string) => {
        // Quitter toutes les rooms précédentes
        socket.rooms.forEach((room) => {
          if (room !== socket.id) {
            socket.leave(room)
          }
        })

        // Rejoindre la nouvelle room
        socket.join(roomId)
        console.log(`Socket ${socket.id} joined room ${roomId}`)

        try {
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
        } catch (error) {
          console.error('Error fetching initial state:', error)
          socket.emit('error', { message: 'Failed to fetch room data' })
        }
      })

      socket.on('REQUEST_TO_SPEAK', async ({ roomId, userId }) => {
        console.log(`User ${userId} requested to speak in room ${roomId}`)
        io?.to(roomId).emit('SPEAKER_REQUEST', userId)
      })

      socket.on('ACCEPT_SPEAKER', async ({ roomId, speakerId }) => {
        try {
          console.log(`Speaker ${speakerId} accepted in room ${roomId}`)
          
          // Ajouter le speaker dans la base de données
          const speakerCount = await prisma.speaker.count({
            where: { roomId },
          })

          await prisma.speaker.create({
            data: {
              roomId,
              userId: speakerId,
              position: speakerCount + 1,
            },
          })

          io?.to(roomId).emit('SPEAKER_ACCEPTED', speakerId)
        } catch (error) {
          console.error('Error accepting speaker:', error)
        }
      })

      socket.on('REMOVE_SPEAKER', async ({ roomId, speakerId }) => {
        try {
          console.log(`Speaker ${speakerId} removed from room ${roomId}`)
          
          // Supprimer le speaker de la base de données
          await prisma.speaker.deleteMany({
            where: {
              roomId: roomId,
              userId: speakerId,
            },
          })

          // Informer tous les clients de la room
          io?.to(roomId).emit('SPEAKER_REMOVED', speakerId)
          
          console.log('Speaker removed successfully')
        } catch (error) {
          console.error('Error removing speaker:', error)
        }
      })

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id)
      })

      socket.on('error', (error) => {
        console.error('Socket error:', error)
      })

      // Autres gestionnaires d'événements...
    })

    res.socket.server.io = io
  } else {
    io = res.socket.server.io
  }

  res.end()
}

export default ioHandler
