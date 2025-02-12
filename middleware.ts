import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Autoriser les requêtes WebSocket
  if (request.headers.get('upgrade') === 'websocket') {
    return NextResponse.next()
  }

  // Pour toutes les autres requêtes, continuer normalement
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/socketio',
  ],
}
