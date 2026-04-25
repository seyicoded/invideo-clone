const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs-extra');

// Import services
const scriptService = require('../services/scriptService');
const sceneService = require('../services/sceneService');
const mediaService = require('../services/mediaService');
const ttsService = require('../services/ttsService');
const videoService = require('../services/videoService');
const ffmpegUtil = require('../utils/ffmpeg');

const router = express.Router();

// Store active projects in memory (in production, use a database)
const activeProjects = new Map();

// Main video generation endpoint
router.post('/generate', async (req, res) => {
  const projectId = uuidv4();
  
  try {
    console.log(`🚀 Starting video generation for project: ${projectId}`);
    
    const { prompt } = req.body;
    
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Missing or invalid prompt',
        message: 'Please provide a valid text prompt for video generation'
      });
    }

    // Initialize project tracking
    activeProjects.set(projectId, {
      id: projectId,
      prompt: prompt.trim(),
      status: 'starting',
      progress: 0,
      steps: {
        script: 'pending',
        scenes: 'pending',
        media: 'pending',
        audio: 'pending',
        video: 'pending'
      },
      startTime: Date.now()
    });

    // Send immediate response with project ID
    res.json({
      projectId: projectId,
      status: 'started',
      message: 'Video generation started',
      estimatedTime: '2-5 minutes'
    });

    // Start async video generation process
    generateVideoAsync(projectId, prompt.trim());

  } catch (error) {
    console.error('Error starting video generation:', error);
    res.status(500).json({ 
      error: 'Failed to start video generation',
      message: error.message 
    });
  }
});

// Get project status
router.get('/status/:projectId', (req, res) => {
  const { projectId } = req.params;
  
  const project = activeProjects.get(projectId);
  
  if (!project) {
    return res.status(404).json({ 
      error: 'Project not found',
      message: 'The specified project ID does not exist or has expired'
    });
  }
  
  res.json(project);
});

// Get generated video
router.get('/download/:projectId', async (req, res) => {
  const { projectId } = req.params;
  
  const project = activeProjects.get(projectId);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  if (project.status !== 'completed' || !project.videoPath) {
    return res.status(400).json({ 
      error: 'Video not ready',
      status: project.status 
    });
  }
  
  const videoPath = project.videoPath;
  
  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: 'Video file not found' });
  }
  
  res.download(videoPath, `invideo-${projectId}.mp4`);
});

// List all projects (for debugging)
router.get('/projects', (req, res) => {
  const projects = Array.from(activeProjects.values()).map(project => ({
    id: project.id,
    prompt: project.prompt,
    status: project.status,
    progress: project.progress,
    startTime: project.startTime,
    completedAt: project.completedAt
  }));
  
  res.json(projects);
});

// Delete project
router.delete('/project/:projectId', async (req, res) => {
  const { projectId } = req.params;
  
  const project = activeProjects.get(projectId);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  // Clean up files if they exist
  if (project.videoPath && fs.existsSync(project.videoPath)) {
    await fs.remove(project.videoPath);
  }
  
  activeProjects.delete(projectId);
  
  res.json({ message: 'Project deleted successfully' });
});

// Health check for services
router.get('/health', async (req, res) => {
  const healthStatus = {
    ffmpeg: false,
    ollama: false,
    pexels: false,
    tts: true,
    timestamp: new Date().toISOString()
  };
  
  try {
    // Check FFmpeg
    healthStatus.ffmpeg = await ffmpegUtil.checkFFmpegInstallation();
    
    // Check Ollama
    healthStatus.ollama = await scriptService.testOllamaConnection();
    
    // Check Pexels API
    healthStatus.pexels = mediaService.validateApiKey();
    
    // Check TTS
    healthStatus.tts = ttsService.validateTTSSetup();
    
    const allHealthy = Object.values(healthStatus).every(status => 
      typeof status === 'boolean' ? status : true
    );
    
    res.status(allHealthy ? 200 : 206).json(healthStatus);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ 
      ...healthStatus, 
      error: 'Health check failed',
      message: error.message 
    });
  }
});

// Async video generation function
async function generateVideoAsync(projectId, prompt) {
  const project = activeProjects.get(projectId);
  
  try {
    // Step 1: Generate script
    updateProjectStatus(projectId, 'generating_script', 10);
    console.log(`📝 Generating script for: "${prompt}"`);
    
    const script = await scriptService.generateScript(prompt);
    project.script = script;
    project.steps.script = 'completed';
    
    // Step 2: Break into scenes
    updateProjectStatus(projectId, 'creating_scenes', 25);
    console.log('🎬 Breaking script into scenes');
    
    const scenes = await sceneService.breakdownIntoScenes(script);
    console.log(`📋 Generated ${scenes.length} scenes:`);
    scenes.forEach((scene, i) => {
      console.log(`   Scene ${i + 1}: ${scene.duration}s - "${scene.text?.substring(0, 60)}..."`);
    });
    
    const initialDuration = scenes.reduce((total, scene) => total + (scene.duration || 5), 0);
    console.log(`⏱️ Total initial duration: ${initialDuration}s`);
    
    // Save full script to text.txt file in output folder
    await saveScriptToFile(projectId, script, scenes);
    
    project.scenes = scenes;
    project.steps.scenes = 'completed';
    
    // Step 3: Fetch media
    updateProjectStatus(projectId, 'fetching_media', 40);
    console.log('🎥 Fetching media for scenes');
    
    const scenesWithMedia = await mediaService.fetchMediaForScenes(scenes);
    project.steps.media = 'completed';
    
    // Step 4: Generate audio
    updateProjectStatus(projectId, 'generating_audio', 60);
    console.log('🎤 Generating voiceover');
    
    const scenesWithAudio = await ttsService.generateVoiceoverForScenes(scenesWithMedia);
    console.log(`🎵 Audio generation completed:`);
    scenesWithAudio.forEach((scene, i) => {
      const audioStatus = scene.audioPath ? `✅ ${path.basename(scene.audioPath)} (${scene.audioDuration?.toFixed(2) || '?'}s)` : '❌ No audio';
      console.log(`   Scene ${i + 1}: ${audioStatus}`);
    });
    
    project.steps.audio = 'completed';
    
    // Step 5: Create final video
    updateProjectStatus(projectId, 'creating_video', 80);
    console.log('🎬 Creating final video');
    
    const videoResult = await videoService.createVideo(scenesWithAudio, projectId);
    
    // Update project with completion
    project.videoPath = videoResult.videoPath;
    project.videoFilename = videoResult.filename;
    project.duration = videoResult.duration;
    project.steps.video = 'completed';
    project.completedAt = Date.now();
    
    updateProjectStatus(projectId, 'completed', 100);
    
    console.log(`✅ Video generation completed for project: ${projectId}`);
    
  } catch (error) {
    console.error(`❌ Video generation failed for project ${projectId}:`, error);
    
    project.status = 'failed';
    project.error = error.message;
    project.failedAt = Date.now();
    
    activeProjects.set(projectId, project);
  }
}

function updateProjectStatus(projectId, status, progress) {
  const project = activeProjects.get(projectId);
  if (project) {
    project.status = status;
    project.progress = progress;
    project.lastUpdated = Date.now();
    activeProjects.set(projectId, project);
  }
}

// Save script content to text file for review
async function saveScriptToFile(projectId, originalScript, scenes) {
  try {
    const outputDir = path.join(__dirname, '..', 'output');
    await fs.ensureDir(outputDir);
    
    const scriptFilePath = path.join(outputDir, 'text.txt');
    
    // Compile the complete script content
    let fullContent = '';
    
    // Header
    fullContent += '='.repeat(80) + '\n';
    fullContent += `INVIDEO AI CLONE - GENERATED SCRIPT\n`;
    fullContent += `Project ID: ${projectId}\n`;
    fullContent += `Generated: ${new Date().toISOString()}\n`;
    fullContent += '='.repeat(80) + '\n\n';
    
    // Original script from LLM
    fullContent += 'ORIGINAL SCRIPT FROM LLM:\n';
    fullContent += '-'.repeat(40) + '\n';
    fullContent += originalScript + '\n\n';
    
    // Scene breakdown
    fullContent += 'SCENE BREAKDOWN:\n';
    fullContent += '-'.repeat(40) + '\n';
    scenes.forEach((scene, index) => {
      fullContent += `Scene ${index + 1} (${scene.duration}s):\n`;
      fullContent += `Keywords: ${scene.keywords ? scene.keywords.join(', ') : 'N/A'}\n`;
      fullContent += `Text: ${scene.text}\n\n`;
    });
    
    // Complete narration text
    fullContent += 'COMPLETE NARRATION TEXT:\n';
    fullContent += '-'.repeat(40) + '\n';
    const fullNarration = scenes.map(scene => scene.text).join(' ');
    fullContent += fullNarration + '\n\n';
    
    // Statistics
    const totalWords = fullNarration.split(' ').length;
    const totalDuration = scenes.reduce((total, scene) => total + (scene.duration || 5), 0);
    fullContent += 'STATISTICS:\n';
    fullContent += '-'.repeat(40) + '\n';
    fullContent += `Total Scenes: ${scenes.length}\n`;
    fullContent += `Total Words: ${totalWords}\n`;
    fullContent += `Estimated Duration: ${totalDuration} seconds (${(totalDuration / 60).toFixed(1)} minutes)\n`;
    fullContent += `Words per Minute: ${Math.round((totalWords / totalDuration) * 60)}\n\n`;
    
    // Save to file
    await fs.writeFile(scriptFilePath, fullContent, 'utf8');
    
    console.log(`💾 Script saved to: ${scriptFilePath}`);
    console.log(`📊 Script contains ${totalWords} words across ${scenes.length} scenes`);
    
  } catch (error) {
    console.error('❌ Failed to save script to file:', error);
    // Don't throw error - this shouldn't stop video generation
  }
}

// Cleanup old projects (run periodically)
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  for (const [projectId, project] of activeProjects.entries()) {
    const age = now - project.startTime;
    
    if (age > maxAge) {
      console.log(`🗑️ Cleaning up old project: ${projectId}`);
      
      // Clean up video file
      if (project.videoPath && fs.existsSync(project.videoPath)) {
        fs.remove(project.videoPath).catch(console.error);
      }
      
      activeProjects.delete(projectId);
    }
  }
}, 60 * 60 * 1000); // Run every hour

module.exports = router;