import { useState } from 'react'

const EXAMPLE_PROMPTS = [
  "Generate a video about traveling to Greece",
  "Create a video about healthy cooking tips",
  "Make a video about space exploration",
  "Generate a video about morning yoga routine",
  "Create a video about learning photography",
  "Make a video about sustainable living"
]

function VideoGenerator({ onGenerate, isGenerating, onReset, showReset }) {
  const [prompt, setPrompt] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (!prompt.trim()) {
      alert('Please enter a prompt for video generation')
      return
    }
    
    if (prompt.length < 10) {
      alert('Please enter a more detailed prompt (at least 10 characters)')
      return
    }
    
    onGenerate(prompt.trim())
  }

  const handleExampleClick = (examplePrompt) => {
    setPrompt(examplePrompt)
  }

  const handleReset = () => {
    setPrompt('')
    onReset()
  }

  return (
    <div className="card">
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label htmlFor="prompt">
            🎬 What video would you like to create?
          </label>
          <textarea
            id="prompt"
            className="prompt-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., Generate a video about traveling to Greece with beautiful landscapes, local cuisine, and cultural highlights..."
            disabled={isGenerating}
            maxLength={500}
          />
          <div style={{ 
            textAlign: 'right', 
            fontSize: '0.8rem', 
            color: 'rgba(255, 255, 255, 0.6)',
            marginTop: '0.5rem'
          }}>
            {prompt.length}/500 characters
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            type="submit"
            className="generate-btn"
            disabled={isGenerating || !prompt.trim()}
          >
            {isGenerating ? (
              <>
                <span className="loading-spinner"></span>
                Generating Video...
              </>
            ) : (
              '🚀 Generate Video'
            )}
          </button>

          {showReset && (
            <button
              type="button"
              onClick={handleReset}
              className="generate-btn"
              style={{
                background: 'linear-gradient(45deg, #95a5a6, #7f8c8d)',
                flex: 'none',
                padding: '0.8rem 1.5rem',
                fontSize: '0.9rem'
              }}
              disabled={isGenerating}
            >
              🔄 New Video
            </button>
          )}
        </div>
      </form>

      {!isGenerating && (
        <div className="examples">
          <h3>💡 Try these examples:</h3>
          <div className="example-prompts">
            {EXAMPLE_PROMPTS.map((examplePrompt, index) => (
              <button
                key={index}
                className="example-prompt"
                onClick={() => handleExampleClick(examplePrompt)}
                type="button"
              >
                {examplePrompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {isGenerating && (
        <div style={{ 
          marginTop: '1.5rem',
          padding: '1rem',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <p style={{ 
            margin: 0, 
            fontSize: '0.9rem', 
            color: 'rgba(255, 255, 255, 0.7)' 
          }}>
            ⏱️ Estimated time: 2-5 minutes
            <br />
            💡 The video generation process involves multiple AI services and may take some time
          </p>
        </div>
      )}
    </div>
  )
}

export default VideoGenerator