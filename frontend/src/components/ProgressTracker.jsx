import { formatDuration } from '../services/api'

const STATUS_MESSAGES = {
  'starting': 'Initializing video generation...',
  'generating_script': 'Creating video script with AI...',
  'creating_scenes': 'Breaking script into scenes...',
  'fetching_media': 'Searching for perfect stock footage...',
  'generating_audio': 'Generating professional voiceover...',
  'creating_video': 'Composing final video with FFmpeg...',
  'completed': 'Video generation completed!',
  'failed': 'Video generation failed'
}

const STATUS_ICONS = {
  'starting': '🚀',
  'generating_script': '📝',
  'creating_scenes': '🎬',
  'fetching_media': '🎥',
  'generating_audio': '🎤',
  'creating_video': '🎞️',
  'completed': '✅',
  'failed': '❌'
}

function ProgressTracker({ project }) {
  if (!project) return null

  const getElapsedTime = () => {
    if (!project.startTime) return 0
    return Math.floor((Date.now() - project.startTime) / 1000)
  }

  const getStepStatus = (stepName) => {
    return project.steps ? project.steps[stepName] : 'pending'
  }

  const renderStepItem = (stepName, stepLabel) => {
    const status = getStepStatus(stepName)
    return (
      <div
        key={stepName}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0.5rem',
          marginBottom: '0.5rem',
          borderRadius: '6px',
          background: status === 'completed' 
            ? 'rgba(76, 175, 80, 0.2)' 
            : status === 'pending' 
            ? 'rgba(255, 255, 255, 0.05)' 
            : 'rgba(255, 193, 7, 0.2)'
        }}
      >
        <span style={{ marginRight: '0.5rem', fontSize: '1.2rem' }}>
          {status === 'completed' ? '✅' : status === 'pending' ? '⏳' : '🔄'}
        </span>
        <span style={{ 
          fontSize: '0.9rem',
          color: status === 'completed' 
            ? 'rgba(200, 255, 200, 0.9)' 
            : 'rgba(255, 255, 255, 0.7)'
        }}>
          {stepLabel}
        </span>
      </div>
    )
  }

  return (
    <div className="card">
      <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>
        {STATUS_ICONS[project.status] || '🔄'} Video Generation Progress
      </h2>

      {/* Main Progress Bar */}
      <div className="progress-container">
        <div className="progress-text">
          {STATUS_MESSAGES[project.status] || 'Processing...'}
        </div>
        
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${project.progress || 0}%` }}
          />
        </div>
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          fontSize: '0.8rem',
          color: 'rgba(255, 255, 255, 0.6)',
          marginTop: '0.5rem'
        }}>
          <span>{project.progress || 0}% complete</span>
          <span>Elapsed: {formatDuration(getElapsedTime())}</span>
        </div>
      </div>

      {/* Detailed Steps */}
      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ 
          fontSize: '1rem', 
          marginBottom: '1rem',
          color: 'rgba(255, 255, 255, 0.8)'
        }}>
          Pipeline Steps:
        </h3>
        
        <div>
          {renderStepItem('script', '📝 Generate Script')}
          {renderStepItem('scenes', '🎬 Create Scenes')}
          {renderStepItem('media', '🎥 Fetch Media')}
          {renderStepItem('audio', '🎤 Generate Audio')}
          {renderStepItem('video', '🎞️ Compose Video')}
        </div>
      </div>

      {/* Project Details */}
      <div style={{ 
        marginTop: '2rem',
        padding: '1rem',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '8px',
        fontSize: '0.9rem',
        color: 'rgba(255, 255, 255, 0.7)'
      }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <strong>Project ID:</strong> {project.id}
        </div>
        <div style={{ marginBottom: '0.5rem' }}>
          <strong>Prompt:</strong> "{project.prompt}"
        </div>
        {project.scenes && project.scenes.length > 0 && (
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>Scenes Created:</strong> {project.scenes.length}
          </div>
        )}
        <div>
          <strong>Started:</strong> {new Date(project.startTime).toLocaleTimeString()}
        </div>
      </div>

      {/* Real-time Status Updates */}
      {project.status !== 'completed' && project.status !== 'failed' && (
        <div style={{
          marginTop: '1rem',
          fontSize: '0.8rem',
          color: 'rgba(255, 255, 255, 0.6)',
          fontStyle: 'italic',
          textAlign: 'center'
        }}>
          Status updates every 3 seconds...
        </div>
      )}
    </div>
  )
}

export default ProgressTracker