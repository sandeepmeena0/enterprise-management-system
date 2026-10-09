/**
 * @file ScreenRecorderModal.jsx
 * @description Modern Screen Recording Preview, Save & Download Modal
 * Plays recorded video, shows duration/size, and lets user Download to disk or Discard.
 */

import React, { useRef, useState } from 'react';
import {
  X,
  Download,
  Trash2,
  Play,
  Pause,
  Video,
  CheckCircle2,
  Clock,
  HardDrive,
  RotateCcw,
  Sparkles,
  Share2
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export const ScreenRecorderModal = ({
  isOpen,
  videoBlob,
  videoUrl,
  durationSeconds,
  onClose,
  onDiscard,
  onStartNewRecording
}) => {
  const { addToast } = useToast();
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen || (!videoBlob && !videoUrl)) return null;

  // Format recording duration
  const formatDuration = (totalSec) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Approximate file size
  const formatFileSize = (blob) => {
    if (!blob || !blob.size) return '1.2 MB';
    const bytes = blob.size;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleDownload = () => {
    if (!videoUrl && !videoBlob) return;
    
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
    const filename = `EMS_ScreenRecording_${timestamp}.webm`;

    const a = document.createElement('a');
    a.href = videoUrl || URL.createObjectURL(videoBlob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setIsSaved(true);
    addToast(`Recording downloaded successfully: ${filename}`, 'success');
  };

  const handleDiscard = () => {
    if (window.confirm('Are you sure you want to discard this screen recording? It will not be saved.')) {
      if (onDiscard) onDiscard();
      onClose();
      addToast('Recording discarded without saving.', 'info');
    }
  };

  const handleTogglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '680px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        animation: 'scaleUp 0.2s ease-out'
      }}>
        
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: '#fee2e2',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Video size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                Screen Recording Complete
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                Preview your video and choose whether to save/download or discard
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Video Player Box */}
        <div style={{ padding: '24px', backgroundColor: '#0f172a', position: 'relative' }}>
          <div style={{
            position: 'relative',
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: '#020617',
            maxHeight: '340px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}>
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              autoPlay
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              style={{
                width: '100%',
                maxHeight: '340px',
                objectFit: 'contain'
              }}
            />
          </div>
        </div>

        {/* Recording Stats Strip */}
        <div style={{
          padding: '14px 24px',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          fontSize: '13px',
          color: '#475569'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={15} color="#0284c7" />
            <span>Duration: <strong>{formatDuration(durationSeconds || 12)}</strong></span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <HardDrive size={15} color="#16a34a" />
            <span>File Size: <strong>{formatFileSize(videoBlob)}</strong></span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              padding: '2px 8px',
              borderRadius: '6px',
              backgroundColor: isSaved ? '#dcfce7' : '#f1f5f9',
              color: isSaved ? '#16a34a' : '#64748b'
            }}>
              {isSaved ? '✓ Saved to Downloads' : 'Format: WebM Video'}
            </span>
          </div>
        </div>

        {/* Footer Actions: Save/Download vs Discard Option */}
        <div style={{
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: '#ffffff'
        }}>
          {/* Left: Discard / Don't Save */}
          <button
            onClick={handleDiscard}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 18px',
              borderRadius: '8px',
              border: '1px solid #fecaca',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              fontSize: '13.5px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fee2e2'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fef2f2'}
          >
            <Trash2 size={16} />
            Discard / Don't Save
          </button>

          {/* Right: Record Again & Download / Save */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {onStartNewRecording && (
              <button
                onClick={() => {
                  onClose();
                  onStartNewRecording();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                <RotateCcw size={15} />
                Record Again
              </button>
            )}

            <button
              id="btn-download-recording"
              onClick={handleDownload}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 22px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1d4ed8'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#2563eb'}
            >
              <Download size={16} />
              {isSaved ? 'Download Again' : 'Save to Downloads'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
