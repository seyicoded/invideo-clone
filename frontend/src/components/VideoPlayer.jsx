import { useState } from 'react'
import { downloadVideo, formatDuration } from '../services/api'

function VideoPlayer({ project, onReset }) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState(null)

  const handleDownload = async () => {
    try {
      setIsDownloading(true)
      setDownloadError(null)
      
      await downloadVideo(project.id)
      
      // Show success message briefly
      setDownloadError('Download started successfully!')
      setTimeout(() => setDownloadError(null), 3000)
      
    } catch (error) {
      console.error('Download failed:', error)
      setDownloadError(error.message || 'Download failed')
    } finally {
      setIsDownloading(false)
    }
  }

  const getVideoUrl = () => {
    return `/api/video/download/${project.id}`
  }

  const getTotalDuration = () => {
    if (project.duration) return project.duration
    if (project.scenes && project.scenes.length > 0) {
      return project.scenes.reduce((total, scene) => total + (scene.duration || 5), 0)
    }
    return 0
  }

  return (
    <div className="card">
      <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>
        ✅ Video Generation Complete!
      </h2>

      {/* Video Player */}
      <div className="video-container">
        <video
          className="video-player"
          controls
          preload="metadata"
          style={{
            width: '100%',
            maxWidth: '800px',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
          }}
        >
          <source src={getVideoUrl()} type="video/mp4" />
          <p style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            Your browser doesn't support video playback. 
            <a 
              href={getVideoUrl()} 
              style={{ color: '#4ECDC4', marginLeft: '0.5rem' }}
            >
              Download the video
            </a>
          </p>
        </video>
      </div>

      {/* Action Buttons */}
      <div style={{ 
        marginTop: '2rem',
        display: 'flex',
        gap: '1rem',
        justifyContent: 'center',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="download-btn"
        >
          {isDownloading ? (
            <>
              <span className="loading-spinner"></span>
              Downloading...
            </>
          ) : (
            <>
              📥 Download Video
            </>
          )}
        </button>

        <button
          onClick={onReset}
          className="generate-btn"
          style={{
            background: 'linear-gradient(45deg, #95a5a6, #7f8c8d)',
            padding: '0.8rem 1.5rem',
            fontSize: '1rem'
          }}
        >
          🔄 Create New Video
        </button>

        <a
          href={getVideoUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="download-btn"
          style={{
            background: 'linear-gradient(45deg, #9b59b6, #8e44ad)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center'
          }}
        >
          🔗 Open in New Tab
        </a>
      </div>

      {/* Download Status */}
      {downloadError && (
        <div 
          className={downloadError.includes('success') ? 'success-message' : 'error-message'}
          style={{ marginTop: '1rem' }}
        >
          {downloadError}
        </div>
      )}

      {/* Video Details */}
      <div style={{ 
        marginTop: '2rem',
        padding: '1.5rem',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <h3 style={{ 
          fontSize: '1.1rem', 
          marginBottom: '1rem',
          color: 'rgba(255, 255, 255, 0.9)'
        }}>
          📊 Video Details
        </h3>
        
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          fontSize: '0.9rem',
          color: 'rgba(255, 255, 255, 0.7)'
        }}>
          <div>
            <strong>Prompt:</strong>
            <div style={{ marginTop: '0.25rem', fontStyle: 'italic' }}>
              "{project.prompt}"
            </div>
          </div>
          
          <div>
            <strong>Duration:</strong>
            <div style={{ marginTop: '0.25rem' }}>
              {formatDuration(getTotalDuration())}
            </div>
          </div>
          
          <div>
            <strong>Scenes:</strong>
            <div style={{ marginTop: '0.25rem' }}>
              {project.scenes ? project.scenes.length : 'N/A'}
            </div>
          </div>
          
          <div>
            <strong>Generated:</strong>
            <div style={{ marginTop: '0.25rem' }}>
              {project.completedAt 
                ? new Date(project.completedAt).toLocaleString()
                : 'Just now'
              }
            </div>
          </div>
          
          <div>
            <strong>Project ID:</strong>
            <div style={{ 
              marginTop: '0.25rem',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              wordBreak: 'break-all'
            }}>
              {project.id}
            </div>
          </div>
          
          <div>
            <strong>Generation Time:</strong>
            <div style={{ marginTop: '0.25rem' }}>
              {project.completedAt && project.startTime
                ? formatDuration((project.completedAt - project.startTime) / 1000)
                : 'N/A'
              }
            </div>
          </div>
        </div>
      </div>

      {/* Scene Breakdown */}
      {project.scenes && project.scenes.length > 0 && (
        <div style={{ 
          marginTop: '2rem',
          padding: '1.5rem',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <h3 style={{ 
            fontSize: '1.1rem', 
            marginBottom: '1rem',
            color: 'rgba(255, 255, 255, 0.9)'
          }}>
            🎬 Scene Breakdown
          </h3>
          
          <div style={{ 
            display: 'grid',
            gap: '1rem'
          }}>
            {project.scenes.map((scene, index) => (
              <div
                key={scene.id || index}
                style={{
                  padding: '1rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                <div style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '0.5rem'
                }}>
                  <strong style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    Scene {index + 1}
                  </strong>
                  <span style={{ 
                    fontSize: '0.8rem',
                    color: 'rgba(255, 255, 255, 0.6)'
                  }}>
                    {formatDuration(scene.duration)}
                  </span>
                </div>
                
                <div style={{ 
                  fontSize: '0.9rem',
                  color: 'rgba(255, 255, 255, 0.7)',
                  marginBottom: '0.5rem'
                }}>
                  {scene.text}
                </div>
                
                {scene.keywords && scene.keywords.length > 0 && (
                  <div style={{ 
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.25rem'
                  }}>
                    {scene.keywords.map((keyword, keyIndex) => (
                      <span
                        key={keyIndex}
                        style={{
                          fontSize: '0.7rem',
                          background: 'rgba(76, 175, 80, 0.2)',
                          color: 'rgba(200, 255, 200, 0.9)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '12px',
                          border: '1px solid rgba(76, 175, 80, 0.3)'
                        }}
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default VideoPlayer