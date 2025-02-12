import { useEffect, useRef, useState } from 'react'

interface PeerConnection {
  userId: string
  connection: RTCPeerConnection
  stream?: MediaStream
}

export function useWebRTC(roomId: string, userId: string, isSpeaker: boolean) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const peerConnections = useRef<Map<string, PeerConnection>>(new Map())
  const socketRef = useRef<WebSocket | null>(null)

  // Nettoyer les connexions existantes
  const cleanupConnections = () => {
    peerConnections.current.forEach((peer) => {
      peer.connection.close()
      if (peer.stream) {
        peer.stream.getTracks().forEach(track => track.stop())
      }
    })
    peerConnections.current.clear()
  }

  // Initialiser WebSocket pour la signalisation
  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}/api/rtc`)
    socketRef.current = ws

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === 'offer' && isSpeaker) {
        // Vérifier si une connexion existe déjà
        const existingPeer = peerConnections.current.get(data.from)
        if (existingPeer) {
          console.log('Connection already exists for user:', data.from)
          return
        }

        const pc = createPeerConnection(data.from)
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        
        ws.send(JSON.stringify({
          type: 'answer',
          to: data.from,
          from: userId,
          answer
        }))
      }
      
      if (data.type === 'answer') {
        const pc = peerConnections.current.get(data.from)?.connection
        if (pc && pc.signalingState !== 'stable') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer))
        }
      }
      
      if (data.type === 'ice-candidate') {
        const pc = peerConnections.current.get(data.from)?.connection
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
        }
      }

      if (data.type === 'user-left') {
        const peer = peerConnections.current.get(data.userId)
        if (peer) {
          peer.connection.close()
          if (peer.stream) {
            peer.stream.getTracks().forEach(track => track.stop())
          }
          peerConnections.current.delete(data.userId)
        }
      }
    }

    return () => {
      ws.close()
      cleanupConnections()
    }
  }, [roomId, userId, isSpeaker])

  // Gérer le flux audio local
  useEffect(() => {
    let stream: MediaStream | null = null

    if (isSpeaker) {
      navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then((mediaStream) => {
          stream = mediaStream
          setLocalStream(stream)
          stream.getAudioTracks()[0].enabled = !isMuted
        })
        .catch((error) => {
          console.error('Error accessing microphone:', error)
        })
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
      setLocalStream(null)
    }
  }, [isSpeaker])

  const createPeerConnection = (targetUserId: string) => {
    // Vérifier si une connexion existe déjà
    const existingPeer = peerConnections.current.get(targetUserId)
    if (existingPeer) {
      console.log('Reusing existing connection for user:', targetUserId)
      return existingPeer.connection
    }

    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ]
    }

    const pc = new RTCPeerConnection(config)

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          to: targetUserId,
          from: userId,
          candidate: event.candidate
        }))
      }
    }

    pc.ontrack = (event) => {
      const [stream] = event.streams
      const connection = peerConnections.current.get(targetUserId)
      if (connection) {
        connection.stream = stream
        peerConnections.current.set(targetUserId, connection)
      }
    }

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        const peer = peerConnections.current.get(targetUserId)
        if (peer) {
          peer.connection.close()
          if (peer.stream) {
            peer.stream.getTracks().forEach(track => track.stop())
          }
          peerConnections.current.delete(targetUserId)
        }
      }
    }

    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream)
      })
    }

    peerConnections.current.set(targetUserId, { userId: targetUserId, connection: pc })
    return pc
  }

  const connectToPeer = async (targetUserId: string) => {
    if (!socketRef.current || targetUserId === userId) return

    try {
      // Vérifier si une connexion existe déjà
      const existingPeer = peerConnections.current.get(targetUserId)
      if (existingPeer && existingPeer.connection.connectionState === 'connected') {
        console.log('Already connected to peer:', targetUserId)
        return
      }

      const pc = createPeerConnection(targetUserId)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      socketRef.current.send(JSON.stringify({
        type: 'offer',
        to: targetUserId,
        from: userId,
        offer
      }))
    } catch (error) {
      console.error('Error connecting to peer:', error)
    }
  }

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      audioTrack.enabled = !audioTrack.enabled
      setIsMuted(!audioTrack.enabled)
    }
  }

  return {
    localStream,
    isMuted,
    toggleMute,
    connectToPeer,
  }
}
