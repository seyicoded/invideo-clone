import { useState, useEffect } from 'react'
import VideoGenerator from './components/VideoGenerator'
import VideoPlayer from './components/VideoPlayer'
import ProgressTracker from './components/ProgressTracker'
import { generateVideo, getProjectStatus } from './services/api'

function App() {
  const [currentProject, setCurrentProject] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [completedVideo, setCompletedVideo] = useState(null)

  // Poll for project status when generating
  useEffect(() => {
    let interval = null
    
    if (currentProject && isGenerating) {
      interval = setInterval(async () => {
        try {
          const status = await getProjectStatus(currentProject.projectId)
          
          setCurrentProject(status)
          
          if (status.status === 'completed') {
            setIsGenerating(false)
            setCompletedVideo(status)
            clearInterval(interval)
          } else if (status.status === 'failed') {
            setIsGenerating(false)
            setError(status.error || 'Video generation failed')
            clearInterval(interval)
          }
        } catch (err) {
          console.error('Error checking status:', err)
          setError('Failed to check generation status')
          setIsGenerating(false)
          clearInterval(interval)
        }
      }, 3000) // Check every 3 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [currentProject, isGenerating])

  const handleGenerateVideo = async (prompt) => {
    try {
      setError(null)
      setCompletedVideo(null)
      setIsGenerating(true)
      
      console.log('Starting video generation for:', prompt)
      
      const response = await generateVideo(prompt)
      setCurrentProject(response)
      
    } catch (err) {
      console.error('Generation error:', err)
      setError(err.message || 'Failed to start video generation')
      setIsGenerating(false)
    }
  }

  const handleReset = () => {
    setCurrentProject(null)
    setIsGenerating(false)
    setError(null)
    setCompletedVideo(null)
  }

  return (
    <div className="container">
      <header>
        <h1>🎥 InVideo AI Clone</h1>
        <p style={{ 
          fontSize: '1.2rem', 
          marginBottom: '2rem', 
          color: 'rgba(255, 255, 255, 0.8)' 
        }}>
          Generate amazing videos from simple text prompts
        </p>
      </header>

      <main>
        <VideoGenerator 
          onGenerate={handleGenerateVideo}
          isGenerating={isGenerating}
          onReset={handleReset}
          showReset={completedVideo || error}
        />

        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {currentProject && isGenerating && (
          <ProgressTracker project={currentProject} />
        )}

        {completedVideo && (
          <VideoPlayer 
            project={completedVideo}
            onReset={handleReset}
          />
        )}
      </main>

      <footer className="footer">
        <p>
          Built with ❤️ using React + Node.js + FFmpeg + AI
        </p>
        <p>
          <small>
            Powered by Ollama for script generation, Pexels for stock media, 
            and FFmpeg for video processing
          </small>
        </p>
      </footer>
    </div>
  )
}

export default App