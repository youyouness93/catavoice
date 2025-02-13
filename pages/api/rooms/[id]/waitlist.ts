import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id: roomId } = req.query;

  if (typeof roomId !== 'string') {
    return res.status(400).json({ error: 'Invalid room ID' });
  }

  try {
    switch (req.method) {
      case 'GET':
        const waitlist = await prisma.waitlist.findMany({
          where: { roomId },
          include: { user: true },
          orderBy: { position: 'asc' },
        });
        return res.status(200).json(waitlist);

      case 'POST':
        const { userId } = req.body;
        if (!userId) {
          return res.status(400).json({ error: 'User ID is required' });
        }

        const waitlistCount = await prisma.waitlist.count({
          where: { roomId },
        });

        const newWaitlistItem = await prisma.waitlist.create({
          data: {
            roomId,
            userId,
            position: waitlistCount + 1,
          },
          include: { user: true },
        });

        return res.status(201).json(newWaitlistItem);

      case 'DELETE':
        const { userId: userIdToDelete } = req.body;
        if (!userIdToDelete) {
          return res.status(400).json({ error: 'User ID is required' });
        }

        await prisma.waitlist.delete({
          where: {
            roomId_userId: {
              roomId,
              userId: userIdToDelete,
            },
          },
        });

        return res.status(200).json({ message: 'User removed from waitlist' });

      default:
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error('Waitlist API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
