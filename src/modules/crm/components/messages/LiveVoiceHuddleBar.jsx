import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneOff,
  Users,
  Radio,
  Lock,
  Coffee,
  Sparkles,
  PhoneCall,
  Volume1
} from 'lucide-react';
import { useTimer } from '../../../../shared/context/TimerContext';
import { useToast } from '../../../../shared/context/ToastContext';
import { API_BASE } from '../../../../shared/config/apiConfig';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

/**
 * @file LiveVoiceHuddleBar.jsx
 * @description Real-time Cross-Device WebRTC Voice Huddle & Intercom for 1-on-1 and Group Channels.
 * Synchronized across laptops, mobiles, and browsers via MongoDB Atlas signaling and STUN P2P audio.
 */
export const LiveVoiceHuddleBar = ({
  activeConv,
  currentUser,
  activePartner,
  partnerShiftState,
  isChannel,
  employees
}) => {
  const { isClockedIn, isOnBreak, breakType } = useTimer();
  const { addToast } = useToast();

  const [isInHuddle, setIsInHuddle] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const myId = String(currentUser?._id || currentUser?.id || currentUser?.employeeCode || 'me');

  // Backend synchronized huddle state
  const [huddleMembers, setHuddleMembers] = useState(() => {
    return Array.isArray(activeConv?.activeHuddle?.members) ? activeConv.activeHuddle.members : [];
  });

  const audioStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  // WebRTC Peer connections map: key = peerId, value = RTCPeerConnection
  const peerConnectionsRef = useRef({});
  const remoteAudioElementsRef = useRef({});
  const lastSignalTsRef = useRef(Date.now() - 5000);
  const processedSignalIdsRef = useRef(new Set());

  // Keep huddle members in sync with activeConv from CRMContext
  useEffect(() => {
    if (activeConv?.activeHuddle?.members) {
      setHuddleMembers(activeConv.activeHuddle.members);
      // Auto-detect if current user is recorded in huddle on server
      const foundMe = activeConv.activeHuddle.members.some(m => String(m.id) === myId);
      if (!foundMe && isInHuddle && !isConnecting) {
        // Heartbeat or local reconnect will handle this
      }
    } else {
      if (!isInHuddle) setHuddleMembers([]);
    }
  }, [activeConv?.activeHuddle, myId, isInHuddle, isConnecting]);

  // Helper to send WebRTC signal to server
  const sendSignal = useCallback(async (type, to, payload) => {
    if (!activeConv?.id) return;
    try {
      await fetch(`${API_BASE}/conversations/${activeConv.id}/huddle/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: myId, to, type, payload })
      });
    } catch (err) {
      console.warn('[Huddle] Failed to send signal:', err);
    }
  }, [activeConv?.id, myId]);

  // Create or retrieve PeerConnection for a specific peer
  const getOrCreatePeerConnection = useCallback((peerId) => {
    if (peerConnectionsRef.current[peerId]) {
      return peerConnectionsRef.current[peerId];
    }

    try {
      const pc = new RTCPeerConnection(RTC_CONFIG);

      // Add local audio tracks if microphone is active
      if (audioStreamRef.current) {
        audioStreamRef.current.getAudioTracks().forEach(track => {
          pc.addTrack(track, audioStreamRef.current);
        });
      }

      // Handle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal('ice-candidate', peerId, event.candidate);
        }
      };

      // Handle remote audio stream with mobile-compliant DOM attachment
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          let audioEl = remoteAudioElementsRef.current[peerId];
          if (!audioEl) {
            audioEl = document.createElement('audio');
            audioEl.autoplay = true;
            audioEl.playsInline = true;
            audioEl.style.display = 'none';
            document.body.appendChild(audioEl);
            remoteAudioElementsRef.current[peerId] = audioEl;
          }
          audioEl.srcObject = event.streams[0];
          audioEl.muted = isDeafened;
          audioEl.play().catch(e => console.warn('[Huddle] Audio autoplay notice:', e));
        }
      };

      peerConnectionsRef.current[peerId] = pc;
      return pc;
    } catch (err) {
      console.error('[Huddle] PeerConnection init error:', err);
      return null;
    }
  }, [sendSignal, isDeafened]);

  // Signal Poller & WebRTC Handshake Engine
  useEffect(() => {
    if (!isInHuddle || !activeConv?.id) return;

    let isMounted = true;
    const pollSignals = async () => {
      try {
        const since = Math.max(0, lastSignalTsRef.current - 12000);
        const userCode = encodeURIComponent(currentUser?.employeeCode || '');
        const res = await fetch(`${API_BASE}/conversations/${activeConv.id}/huddle/signals?userId=${encodeURIComponent(myId)}&userCode=${userCode}&since=${since}`);
        if (!res.ok) return;

        const data = await res.json();
        if (!isMounted) return;

        if (data.activeHuddle?.members) {
          setHuddleMembers(data.activeHuddle.members);
        }

        if (Array.isArray(data.signals) && data.signals.length > 0) {
          for (const sig of data.signals) {
            if (!sig || !sig.id || processedSignalIdsRef.current.has(sig.id)) continue;
            processedSignalIdsRef.current.add(sig.id);
            if (processedSignalIdsRef.current.size > 200) {
              const arr = Array.from(processedSignalIdsRef.current);
              processedSignalIdsRef.current = new Set(arr.slice(-100));
            }

            lastSignalTsRef.current = Math.max(lastSignalTsRef.current, sig.createdAt || Date.now());
            const peerId = String(sig.from);
            if (peerId === myId || (currentUser?.employeeCode && peerId === currentUser.employeeCode)) continue;

            const pc = getOrCreatePeerConnection(peerId);
            if (!pc) continue;

            if (sig.type === 'offer') {
              await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              sendSignal('answer', peerId, answer);
            } else if (sig.type === 'answer') {
              if (pc.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
              }
            } else if (sig.type === 'ice-candidate') {
              if (sig.payload) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(sig.payload));
                } catch (iceErr) {
                  console.warn('[Huddle] ICE add error:', iceErr);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('[Huddle] Signal polling error:', err);
      }
    };

    const interval = setInterval(pollSignals, 1200);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isInHuddle, activeConv?.id, myId, getOrCreatePeerConnection, sendSignal]);

  // Periodic Heartbeat while in huddle
  useEffect(() => {
    if (!isInHuddle || !activeConv?.id) return;

    const sendHeartbeat = async () => {
      try {
        await fetch(`${API_BASE}/conversations/${activeConv.id}/huddle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'heartbeat',
            member: {
              id: myId,
              name: currentUser?.name || 'Member',
              avatar: currentUser?.avatar || '',
              role: currentUser?.role || 'Member',
              isMuted
            },
            autoRejoin: true
          })
        });
      } catch (_) {}
    };

    const timer = setInterval(sendHeartbeat, 5000);
    return () => clearInterval(timer);
  }, [isInHuddle, activeConv?.id, myId, currentUser, isMuted]);

  // Update remote audio elements when isDeafened changes
  useEffect(() => {
    Object.values(remoteAudioElementsRef.current).forEach(audioEl => {
      if (audioEl) audioEl.muted = isDeafened;
    });
  }, [isDeafened]);

  // Clean up on beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isInHuddle && activeConv?.id) {
        navigator.sendBeacon?.(
          `${API_BASE}/conversations/${activeConv.id}/huddle`,
          JSON.stringify({
            action: 'leave',
            member: { id: myId }
          })
        );
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isInHuddle, activeConv?.id, myId]);

  // Disconnect & cleanup helper
  const stopAllAudio = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    // Close peer connections
    Object.values(peerConnectionsRef.current).forEach(pc => {
      try { pc.close(); } catch (_) {}
    });
    peerConnectionsRef.current = {};

    // Pause and clean up audio elements from DOM
    Object.values(remoteAudioElementsRef.current).forEach(el => {
      try {
        el.srcObject = null;
        el.pause();
        if (el.parentNode) el.parentNode.removeChild(el);
      } catch (_) {}
    });
    remoteAudioElementsRef.current = {};

    setIsInHuddle(false);
    setIsConnecting(false);
    setAudioLevel(0);
    setIsSpeaking(false);
  };

  // Start Voice Intercom / Huddle
  const joinHuddle = async () => {
    if (!activeConv?.id) {
      addToast('No conversation active.', 'warning');
      return;
    }

    setIsConnecting(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
      audioStreamRef.current = stream;

      // Web Audio setup for visual voice detection ring
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        const audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const checkAudio = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          setAudioLevel(avg);
          setIsSpeaking(avg > 15 && !isMuted);
          animFrameRef.current = requestAnimationFrame(checkAudio);
        };
        checkAudio();
      }

      // Notify backend that I joined
      const res = await fetch(`${API_BASE}/conversations/${activeConv.id}/huddle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          member: {
            id: myId,
            name: currentUser?.name || 'Member',
            avatar: currentUser?.avatar || '',
            role: currentUser?.role || 'Member',
            isMuted: false
          }
        })
      });

      const json = await res.json().catch(() => ({}));
      const updatedMembers = json.activeHuddle?.members || [];
      setHuddleMembers(updatedMembers);
      setIsInHuddle(true);
      setIsConnecting(false);
      lastSignalTsRef.current = Date.now();

      // Initiate WebRTC Offer to all existing peers in the room
      for (const m of updatedMembers) {
        const peerId = String(m.id);
        if (peerId !== myId) {
          const pc = getOrCreatePeerConnection(peerId);
          if (pc) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSignal('offer', peerId, offer);
          }
        }
      }

      addToast('🎙️ Live Voice Talk Connected! Speak freely.', 'success');
    } catch (err) {
      console.error('Microphone error in Live Talk:', err);
      setIsConnecting(false);
      stopAllAudio();
      addToast('Could not access microphone. Please check browser permissions.', 'error');
    }
  };

  const leaveHuddle = async () => {
    stopAllAudio();
    if (activeConv?.id) {
      try {
        await fetch(`${API_BASE}/conversations/${activeConv.id}/huddle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'leave',
            member: { id: myId }
          })
        });
      } catch (_) {}
    }
    addToast('Left Live Voice Talk.', 'info');
  };

  const toggleMute = () => {
    if (!audioStreamRef.current) return;
    const audioTrack = audioStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      const nextMute = !isMuted;
      audioTrack.enabled = !nextMute;
      setIsMuted(nextMute);
      if (nextMute) setIsSpeaking(false);

      if (activeConv?.id) {
        fetch(`${API_BASE}/conversations/${activeConv.id}/huddle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'mute',
            member: { id: myId },
            isMuted: nextMute
          })
        }).catch(() => {});
      }
    }
  };

  const toggleDeafen = () => {
    setIsDeafened(!isDeafened);
  };

  // Clean up on conversation switch
  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, [activeConv?.id]);

  const partnerIsClockedIn = Boolean(partnerShiftState?.isClockedIn);
  const partnerIsOnBreak = Boolean(partnerShiftState?.isOnBreak);

  // ── Render Huddle Bar ──
  return (
    <div className="shrink-0 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-[#0c1427]/90 text-xs transition-all">
      {/* If Currently In Huddle */}
      {isInHuddle ? (
        <div className="p-2 sm:p-2.5 px-3 sm:px-5 flex items-center justify-between gap-3 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {/* Participants Avatars List */}
            <div className="flex items-center -space-x-2 shrink-0">
              {huddleMembers.map(m => {
                const isMe = String(m.id) === myId;
                const memberSpeaking = isMe ? isSpeaking : false;
                return (
                  <div key={m.id} className="relative group" title={`${m.name} (${m.role || 'Member'})`}>
                    <img
                      src={m.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                      alt={m.name}
                      className={`w-8 h-8 rounded-full object-cover transition-all ${
                        memberSpeaking ? 'ring-3 ring-emerald-500 scale-105 shadow-md shadow-emerald-500/40' : 'ring-1 ring-slate-300 dark:ring-slate-700'
                      }`}
                    />
                    {memberSpeaking && (
                      <span className="absolute -inset-1 rounded-full bg-emerald-500/30 animate-ping -z-10" />
                    )}
                    {m.isMuted && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-rose-600 text-white flex items-center justify-center text-[8px] font-bold">
                        ✕
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-[12.5px] text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Radio size={14} className="text-emerald-500 animate-pulse shrink-0" />
                  <span>{isChannel ? `Group Voice Huddle (${huddleMembers.length})` : '1-on-1 Shift Intercom'}</span>
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                  isSpeaking
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono animate-pulse'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}>
                  {isMuted ? 'Muted' : isSpeaking ? 'Speaking...' : 'Listening'}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {isChannel
                  ? `${huddleMembers.length} member(s) connected • All can speak and listen in real-time`
                  : `Live voice connected with ${activePartner?.name || 'Partner'}`}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Mute Toggle */}
            <button
              type="button"
              onClick={toggleMute}
              className={`p-1.5 px-2.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors border ${
                isMuted
                  ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
              }`}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff size={14} /> : <Mic size={14} className="text-emerald-600" />}
              <span className="hidden sm:inline text-[11px]">{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            {/* Deafen Toggle */}
            <button
              type="button"
              onClick={toggleDeafen}
              className={`p-1.5 px-2 rounded-lg cursor-pointer transition-colors border ${
                isDeafened
                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
              }`}
              title={isDeafened ? 'Undeafen audio' : 'Deafen (mute incoming audio)'}
            >
              {isDeafened ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>

            {/* Leave Button */}
            <button
              type="button"
              onClick={leaveHuddle}
              className="p-1.5 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1 cursor-pointer border-0 shadow-xs transition-colors"
              title="Leave Voice Huddle"
            >
              <PhoneOff size={13} />
              <span className="text-[11px]">Leave</span>
            </button>
          </div>
        </div>
      ) : (
        /* Not In Huddle - Prompt / Status Banner */
        <div className="p-2 px-3 sm:px-5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {huddleMembers.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-emerald-700 dark:text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                <span className="truncate">
                  📞 Active Live Talk ({huddleMembers.length} member{huddleMembers.length > 1 ? 's' : ''}: {huddleMembers.map(m => m.name).join(', ')})
                </span>
              </span>
            ) : !isChannel ? (
              partnerIsClockedIn && !partnerIsOnBreak ? (
                <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-emerald-700 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{activePartner?.name || 'Partner'} is Clocked In • Ready for Live Talk</span>
                </span>
              ) : partnerIsOnBreak ? (
                <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-amber-600 dark:text-amber-400">
                  <Coffee size={13} />
                  <span>{activePartner?.name || 'Partner'} is on {partnerShiftState?.breakType || 'Break'} (Voice Intercom available)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-slate-500 dark:text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span>{activePartner?.name || 'Partner'} is Clocked Out (Starting Live Talk will alert their device)</span>
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-slate-700 dark:text-slate-300">
                <Users size={13} className="text-blue-600 dark:text-sky-400" />
                <span>Team Voice Huddle: Instant voice room for channel collaboration</span>
              </span>
            )}
          </div>

          {/* Join / Start Button */}
          <div>
            <button
              type="button"
              onClick={joinHuddle}
              disabled={isConnecting}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-[11.5px] transition-all border cursor-pointer ${
                huddleMembers.length > 0
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-500/20 border-transparent animate-pulse'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xs border-transparent'
              }`}
            >
              <Mic size={13} />
              <span>
                {isConnecting
                  ? 'Connecting...'
                  : huddleMembers.length > 0
                  ? '🎙️ Join Live Huddle'
                  : isChannel
                  ? '🎙️ Start Huddle'
                  : '🎙️ Start Live Talk'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
