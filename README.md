# 🎥 InVideo AI Clone

A full-stack application that replicates InVideo AI functionality, allowing users to generate videos from simple text prompts using AI-powered script generation, media fetching, and video composition.

## ✨ Features

- **AI Script Generation**: Uses Ollama API with Mistral/Llama models to create engaging video scripts
- **Intelligent Scene Breakdown**: Automatically splits scripts into optimized video scenes
- **Stock Media Integration**: Fetches high-quality videos from Pexels API based on scene keywords
- **Text-to-Speech**: Generates professional voiceovers using GTTS or Piper TTS
- **Video Composition**: Uses FFmpeg to create polished final videos with overlays and transitions
- **Real-time Progress**: Live updates during video generation process
- **Modern UI**: Clean, responsive React interface with smooth animations

## 🏗️ Architecture

```
invideo-clone/
├── backend/          # Node.js + Express API
│   ├── services/     # Core business logic
│   ├── routes/       # API endpoints
│   ├── utils/        # Helper utilities
│   └── tmp/          # Temporary files
├── frontend/         # React + Vite UI
│   ├── src/
│   │   ├── components/
│   │   └── services/
└── docs/             # Documentation
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 16+ and npm
- **FFmpeg** installed and accessible in PATH
- **Ollama** (optional, for AI script generation)
- **Pexels API Key** (optional, for stock videos)

### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd invideo-clone
```

2. **Install dependencies**

```bash
npm run setup
# or manually:
# npm run install:backend
# npm run install:frontend
```

3. **Set up environment variables**

```bash
# Copy environment template
cp backend/.env.example backend/.env

# Edit the .env file with your configurations
nano backend/.env
```

4. **Install FFmpeg** (if not already installed)

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# Windows (using chocolatey)
choco install ffmpeg
```

5. **Start development servers**

```bash
npm run dev
# This starts both backend (port 3000) and frontend (port 5173)
```

## 🔧 Configuration

### Environment Variables

Create `backend/.env` from the template:

```env
# Backend Configuration
PORT=3000

# Ollama Configuration (for AI script generation)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=mistral

# Pexels API Configuration (get from https://www.pexels.com/api/)
PEXELS_API_KEY=your_pexels_api_key_here

# TTS Configuration
TTS_SERVICE=gtts  # or 'piper' for local TTS

# FFmpeg Configuration
FFMPEG_PATH=/usr/local/bin/ffmpeg  # Optional, if not in PATH

# Directories
OUTPUT_DIR=./output
TMP_DIR=./tmp
```

### Optional Setup

#### Ollama (for AI Script Generation)

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model
ollama pull mistral
# or
ollama pull llama3

# Start Ollama server
ollama serve
```

#### Pexels API Key

1. Sign up at [Pexels API](https://www.pexels.com/api/)
2. Get your free API key
3. Add it to your `.env` file

## 📖 Usage

1. **Open the application** at `http://localhost:5173`

2. **Enter a video prompt** like:
   - "Generate a video about traveling to Greece"
   - "Create a video about healthy cooking tips"
   - "Make a video about space exploration"

3. **Click "Generate Video"** and wait for the process to complete

4. **Watch and download** your generated video!

## 🎬 How It Works

### Video Generation Pipeline

1. **Script Generation** 📝
   - Uses Ollama API with Mistral/Llama models
   - Creates engaging, conversational scripts
   - Fallback to predefined templates if Ollama unavailable

2. **Scene Breakdown** 🎬
   - Splits script into 3-6 optimized scenes
   - Extracts keywords for media search
   - Calculates optimal scene durations

3. **Media Fetching** 🎥
   - Searches Pexels for relevant stock footage
   - Downloads high-quality videos locally
   - Creates fallback colored backgrounds if needed

4. **Audio Generation** 🎤
   - Converts text to speech using GTTS
   - Alternative Piper TTS support for local generation
   - Optimizes audio timing and quality

5. **Video Composition** 🎞️
   - Uses FFmpeg for professional video editing
   - Combines scenes with smooth transitions
   - Overlays voiceover and optional subtitles
   - Exports final MP4 video

## 🛠️ Development

### Project Structure

```
backend/
├── services/
│   ├── scriptService.js     # AI script generation
│   ├── sceneService.js      # Scene breakdown logic
│   ├── mediaService.js      # Pexels integration
│   ├── ttsService.js        # Text-to-speech
│   └── videoService.js      # FFmpeg video composition
├── routes/
│   └── videoRoutes.js       # API endpoints
├── utils/
│   └── ffmpeg.js           # FFmpeg utilities
└── index.js                # Express server

frontend/
├── src/
│   ├── components/
│   │   ├── VideoGenerator.jsx   # Input form
│   │   ├── ProgressTracker.jsx  # Progress display
│   │   └── VideoPlayer.jsx      # Video preview
│   ├── services/
│   │   └── api.js               # Backend integration
│   └── App.jsx                  # Main component
```

### Available Scripts

```bash
# Development
npm run dev              # Start both frontend and backend
npm run dev:backend      # Backend only (port 3000)
npm run dev:frontend     # Frontend only (port 5173)

# Production
npm run build:frontend   # Build frontend for production
npm run start:backend    # Start backend in production mode

# Maintenance
npm run clean           # Clean dependencies and temp files
npm run setup          # Install all dependencies
```

### API Endpoints

- `POST /api/video/generate` - Start video generation
- `GET /api/video/status/:projectId` - Check generation status
- `GET /api/video/download/:projectId` - Download generated video
- `GET /api/video/health` - Check service health
- `GET /api/video/projects` - List all projects

## 🔍 Troubleshooting

### Common Issues

#### FFmpeg Not Found

```bash
# Check FFmpeg installation
ffmpeg -version

# Install if missing (macOS)
brew install ffmpeg

# Add to PATH or set FFMPEG_PATH in .env
```

#### Ollama Connection Failed

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama if needed
ollama serve

# Pull required model
ollama pull mistral
```

#### Pexels API Issues

- Verify API key in `.env` file
- Check API quota limits
- Fallback colored backgrounds will be used if API fails

#### Video Generation Fails

- Check FFmpeg installation and PATH
- Ensure sufficient disk space in `tmp/` and `output/`
- Check server logs for detailed error messages

### Performance Optimization

- **Reduce video quality**: Lower resolution in `videoService.js`
- **Limit scene count**: Modify `maxScenes` in `sceneService.js`
- **Faster encoding**: Change FFmpeg presets to `ultrafast`
- **Cleanup old files**: Regularly clean `tmp/` and `output/` directories

## 🎯 Roadmap

### Planned Features

- [ ] Custom voice selection for TTS
- [ ] Background music integration
- [ ] Subtitle generation and overlay
- [ ] Video style templates
- [ ] Batch video generation
- [ ] User authentication and project management
- [ ] Cloud storage integration
- [ ] Advanced video effects and transitions

### Technical Improvements

- [ ] Database integration for project persistence
- [ ] Redis caching for better performance
- [ ] Docker containerization
- [ ] CI/CD pipeline
- [ ] Unit and integration tests
- [ ] Monitoring and logging improvements

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Ollama** for local AI model inference
- **Pexels** for high-quality stock footage
- **FFmpeg** for powerful video processing
- **React & Vite** for the modern frontend
- **Node.js & Express** for the robust backend

## 📞 Support

If you encounter any issues or have questions:

1. Check the [troubleshooting section](#-troubleshooting)
2. Look through [existing issues](https://github.com/yourusername/invideo-clone/issues)
3. Create a [new issue](https://github.com/yourusername/invideo-clone/issues/new) with detailed information

---

**Built with ❤️ for the AI video generation community**
