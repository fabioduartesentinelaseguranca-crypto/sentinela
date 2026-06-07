/**
 * useTacticalRadio — WebRTC Push-to-Talk walkie-talkie hook
 *
 * Sinalização via base44.entities.OfflineMessage (campo msg_type="audio" + content JSON)
 * Cada peer anuncia: offer, answer, ice-candidate
 * Todos os agentes no mesmo canal escutam e respondem automaticamente.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";

const CHANNEL = "patrol-radio-1";
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export function useTacticalRadio({ agentId, agentName }) {
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [connectedPeers, setConnectedPeers] = useState(0);
  const [error, setError] = useState(null);
  const [volume, setVolume] = useState(1);

  // Map of peerId → RTCPeerConnection
  const peerConns = useRef({});
  // Local mic stream while PTT is pressed
  const localStream = useRef(null);
  // Remote audio elements
  const audioRefs = useRef({});
  // Processed signal IDs to avoid reprocessing
  const processedIds = useRef(new Set());

  // --- helpers ---
  const sendSignal = useCallback(async (type, payload, targetId = null) => {
    await base44.entities.OfflineMessage.create({
      sender_id: agentId,
      sender_name: agentName,
      channel: CHANNEL,
      content: JSON.stringify({ signalType: type, payload, targetId }),
      msg_type: "audio",
      synced: true,
    });
  }, [agentId, agentName]);

  const getOrCreatePeer = useCallback((peerId, isInitiator) => {
    if (peerConns.current[peerId]) return peerConns.current[peerId];

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConns.current[peerId] = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal("ice-candidate", e.candidate, peerId);
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (!audioRefs.current[peerId]) {
        const audio = new Audio();
        audio.autoplay = true;
        audio.srcObject = stream;
        audio.volume = volume;
        audioRefs.current[peerId] = audio;
      }
      setIsReceiving(true);
      // detect when track ends
      stream.getTracks().forEach((t) => {
        t.onended = () => {
          setIsReceiving(false);
        };
      });
    };

    pc.onconnectionstatechange = () => {
      const states = Object.values(peerConns.current).map((p) => p.connectionState);
      setConnectedPeers(states.filter((s) => s === "connected").length);
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        delete peerConns.current[peerId];
        delete audioRefs.current[peerId];
        const remaining = Object.values(peerConns.current).map((p) => p.connectionState);
        setConnectedPeers(remaining.filter((s) => s === "connected").length);
      }
    };

    return pc;
  }, [sendSignal, volume]);

  // Add local tracks to a peer connection
  const addLocalTracks = useCallback((pc) => {
    if (!localStream.current) return;
    localStream.current.getTracks().forEach((track) => {
      const senders = pc.getSenders();
      const already = senders.find((s) => s.track === track);
      if (!already) pc.addTrack(track, localStream.current);
    });
  }, []);

  // Remove local tracks from a peer connection
  const removeLocalTracks = useCallback((pc) => {
    pc.getSenders().forEach((sender) => {
      if (sender.track) pc.removeTrack(sender);
    });
  }, []);

  // --- PTT start ---
  const startTransmitting = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStream.current = stream;
      setIsTransmitting(true);

      // Broadcast "calling" signal so peers know to prepare answer
      await sendSignal("calling", { agentId, agentName });

      // Create offers to all known peers already connected
      for (const peerId of Object.keys(peerConns.current)) {
        const pc = getOrCreatePeer(peerId, true);
        addLocalTracks(pc);
        const offer = await pc.createOffer({ offerToReceiveAudio: true });
        await pc.setLocalDescription(offer);
        await sendSignal("offer", offer, peerId);
      }
    } catch (err) {
      setError(err.message || "Microfone não acessível");
      setIsTransmitting(false);
    }
  }, [sendSignal, agentId, agentName, getOrCreatePeer, addLocalTracks]);

  // --- PTT stop ---
  const stopTransmitting = useCallback(async () => {
    if (localStream.current) {
      localStream.current.getTracks().forEach((t) => t.stop());
      localStream.current = null;
    }
    // Remove tracks from all peer connections
    for (const pc of Object.values(peerConns.current)) {
      removeLocalTracks(pc);
    }
    setIsTransmitting(false);
    await sendSignal("stop-transmitting", { agentId });
  }, [sendSignal, agentId, removeLocalTracks]);

  // --- Signal handling ---
  useEffect(() => {
    const handleSignal = async (msg) => {
      if (!msg.content) return;
      let parsed;
      try { parsed = JSON.parse(msg.content); } catch { return; }
      if (!parsed.signalType) return;
      // Ignore our own signals
      if (msg.sender_id === agentId) return;
      // Ignore signals targeted at other peers
      if (parsed.targetId && parsed.targetId !== agentId) return;

      const peerId = msg.sender_id;
      const { signalType, payload } = parsed;

      if (signalType === "calling") {
        // Another agent started transmitting — prepare to receive
        // Create a peer connection as non-initiator; send offer back so we can receive
        const pc = getOrCreatePeer(peerId, false);
        if (localStream.current) addLocalTracks(pc);
        // We'll send an offer too (bi-directional)
        const offer = await pc.createOffer({ offerToReceiveAudio: true });
        await pc.setLocalDescription(offer);
        await sendSignal("offer", offer, peerId);
      } else if (signalType === "offer") {
        const pc = getOrCreatePeer(peerId, false);
        if (localStream.current) addLocalTracks(pc);
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal("answer", answer, peerId);
      } else if (signalType === "answer") {
        const pc = peerConns.current[peerId];
        if (pc && pc.signalingState !== "stable") {
          await pc.setRemoteDescription(new RTCSessionDescription(payload));
        }
      } else if (signalType === "ice-candidate") {
        const pc = peerConns.current[peerId];
        if (pc) {
          try { await pc.addIceCandidate(new RTCIceCandidate(payload)); } catch {}
        }
      } else if (signalType === "stop-transmitting") {
        setIsReceiving(false);
      }
    };

    const unsub = base44.entities.OfflineMessage.subscribe(async (event) => {
      if (event.type !== "create") return;
      const msg = event.data;
      if (!msg || msg.msg_type !== "audio") return;
      if (msg.channel !== CHANNEL) return;
      if (processedIds.current.has(msg.id)) return;
      processedIds.current.add(msg.id);
      await handleSignal(msg);
    });

    return () => {
      unsub();
      // Cleanup all peers on unmount
      for (const pc of Object.values(peerConns.current)) pc.close();
      peerConns.current = {};
      if (localStream.current) {
        localStream.current.getTracks().forEach((t) => t.stop());
        localStream.current = null;
      }
    };
  }, [agentId, agentName, getOrCreatePeer, addLocalTracks, sendSignal]);

  // Sync volume to audio elements
  useEffect(() => {
    for (const audio of Object.values(audioRefs.current)) {
      audio.volume = volume;
    }
  }, [volume]);

  return {
    isTransmitting,
    isReceiving,
    connectedPeers,
    error,
    volume,
    setVolume,
    startTransmitting,
    stopTransmitting,
  };
}