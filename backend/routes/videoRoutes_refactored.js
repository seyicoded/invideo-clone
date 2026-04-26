const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs-extra');

// Import REFACTORED services
const scriptService = require('../services/scriptService');
const sceneService = require('../services/sceneService');
const mediaService = require('../services/mediaService');
const ttsServiceRefactored = require('../services/ttsService_refactored'); // NEW
const videoServiceRefactored = require('../services/videoService_refactored'); // NEW
const ffmpegUtil = require('../utils/ffmpeg');

const router = express.Router();

// Store active projects in memory (in production, use a database)
const activeProjects = new Map();

// Main video generation endpoint - REFACTORED FLOW
router.post('/generate', async (req, res) => {
  const projectId = uuidv4();
  
  try {
    console.log(`🚀 Starting REFACTORED video generation for project: ${projectId}`);
    console.log(`📋 New Flow: Script → Scenes → Audio → Video`);
    
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
      message: 'Video generation started with refactored flow',
      estimatedTime: '2-5 minutes'
    });

    // Start async video generation process with NEW FLOW
    generateVideoWithRefactoredFlow(projectId, prompt.trim());

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
  
  res.download(videoPath, `invideo-refactored-${projectId}.mp4`);
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
    refactoredServices: true,
    timestamp: new Date().toISOString()
  };
  
  try {
    // Check FFmpeg
    healthStatus.ffmpeg = await ffmpegUtil.checkFFmpegInstallation();
    
    // Check Ollama
    healthStatus.ollama = await scriptService.testOllamaConnection();
    
    // Check Pexels API
    healthStatus.pexels = mediaService.validateApiKey();
    
    // Check Refactored TTS
    healthStatus.tts = ttsServiceRefactored.validateTTSSetup();
    
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

// NEW REFACTORED ASYNC VIDEO GENERATION FUNCTION
async function generateVideoWithRefactoredFlow(projectId, prompt) {
  const project = activeProjects.get(projectId);
  
  try {
    console.log(`\n🎯 === REFACTORED VIDEO GENERATION FLOW ===`);
    console.log(`📋 Flow: Script → Scenes → Media → Audio → Video`);
    
    // =========================
    // STEP 1: Generate Script 
    // =========================
    updateProjectStatus(projectId, 'generating_script', 10);
    console.log(`\n📝 STEP 1: Generating script for: "${prompt}"`);
    
    const script = await scriptService.generateScript(prompt);
    project.script = script;
    project.steps.script = 'completed';
    console.log(`✅ Script generated successfully`);
    
    // =========================
    // STEP 2: Break into Scenes
    // =========================
    updateProjectStatus(projectId, 'creating_scenes', 20);
    console.log(`\n🎬 STEP 2: Breaking script into scenes`);
    
    const scenes = await sceneService.breakdownIntoScenes(script);
    console.log(`✅ Generated ${scenes.length} scenes`);
    scenes.forEach((scene, i) => {
      console.log(`   Scene ${i + 1}: ${scene.duration}s - "${scene.text?.substring(0, 50)}..."`);
    });
    
    const totalSceneDuration = scenes.reduce((total, scene) => total + (scene.duration || 5), 0);
    console.log(`📊 Total scenes duration: ${totalSceneDuration}s`);
    
    // Save script to file
    await saveScriptToFile(projectId, script, scenes);
    project.scenes = scenes;
    project.steps.scenes = 'completed';
    
    // =========================
    // STEP 3: Fetch Media
    // =========================
    updateProjectStatus(projectId, 'fetching_media', 35);
    console.log(`\n🎥 STEP 3: Fetching media for scenes`);
    
    const scenesWithMedia = await mediaService.fetchMediaForScenes(scenes);
    project.steps.media = 'completed';
    console.log(`✅ Media fetching completed`);
    
    // =========================
    // STEP 4: Generate Audio SEQUENCE
    // =========================
    updateProjectStatus(projectId, 'generating_audio', 50);
    console.log(`\n🎤 STEP 4: Generating audio sequence (NEW APPROACH)`);
    
    // NEW: Generate ALL audio first, properly sequenced
    const scenesWithAudio = await ttsServiceRefactored.generateAudioSequence(scenesWithMedia);
    
    // Create master audio track
    const masterAudio = await ttsServiceRefactored.combineAllAudio(scenesWithAudio);
    
    project.steps.audio = 'completed';
    console.log(`✅ Audio sequence completed`);
    console.log(`🎵 Master audio: ${masterAudio.duration.toFixed(2)}s`);
    
    // =========================
    // STEP 5: Create Video AROUND Audio
    // =========================
    updateProjectStatus(projectId, 'creating_video', 75);
    console.log(`\n🎬 STEP 5: Creating video around pre-generated audio (NEW APPROACH)`);
    
    // NEW: Build video around the perfect audio
    const videoResult = await videoServiceRefactored.createVideoFromAudio(
      scenesWithAudio, 
      masterAudio, 
      projectId
    );
    
    project.steps.video = 'completed';
    console.log(`✅ Video creation completed`);
    
    // =========================
    // STEP 6: Finalization
    // =========================
    updateProjectStatus(projectId, 'finalizing', 95);
    console.log(`\n🎯 STEP 6: Finalizing project`);
    
    // Update project with completion
    project.videoPath = videoResult.videoPath;
    project.videoFilename = videoResult.filename;
    project.duration = videoResult.duration;
    project.completedAt = Date.now();
    
    // Cleanup
    await cleanupProjectFiles(scenesWithAudio, masterAudio);
    
    updateProjectStatus(projectId, 'completed', 100);
    
    console.log(`\n🎉 === VIDEO GENERATION COMPLETED ===`);
    console.log(`📊 Project: ${projectId}`);
    console.log(`📁 Output: ${videoResult.filename}`);
    console.log(`⏱️ Duration: ${videoResult.duration.toFixed(2)}s`);
    console.log(`🎬 Scenes: ${videoResult.scenes}`);
    console.log(`⌚ Total Time: ${((Date.now() - project.startTime) / 1000).toFixed(1)}s`);
    
  } catch (error) {
    console.error(`\n❌ === REFACTORED VIDEO GENERATION FAILED ===`);
    console.error(`📊 Project: ${projectId}`);
    console.error(`💥 Error: ${error.message}`);
    console.error(`📍 Stack:`, error.stack);
    
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
    console.log(`📈 Status: ${status} (${progress}%)`);
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
    fullContent += `INVIDEO AI CLONE - REFACTORED GENERATION\n`;
    fullContent += `Project ID: ${projectId}\n`;
    fullContent += `Generated: ${new Date().toISOString()}\n`;
    fullContent += `Flow: Script → Scenes → Media → Audio → Video\n`;
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
    
    fullContent += 'REFACTORED FLOW NOTES:\n';
    fullContent += '-'.repeat(40) + '\n';
    fullContent += `• Audio generated FIRST with exact scene timing\n`;
    fullContent += `• Video built AROUND the perfect audio track\n`;
    fullContent += `• No audio/video sync issues\n`;
    fullContent += `• Sequential processing prevents conflicts\n\n`;
    
    // Save to file
    await fs.writeFile(scriptFilePath, fullContent, 'utf8');
    
    console.log(`💾 Script saved to: ${scriptFilePath}`);
    
  } catch (error) {
    console.error('❌ Failed to save script to file:', error);
    // Don't throw error - this shouldn't stop video generation
  }
}

// Clean up temporary files after completion
async function cleanupProjectFiles(scenesWithAudio, masterAudio) {
  try {
    console.log('🧹 Cleaning up temporary files');
    
    // Clean up individual scene audio files
    for (const scene of scenesWithAudio) {
      if (scene.audioPath && fs.existsSync(scene.audioPath)) {
        await fs.remove(scene.audioPath);
      }
    }
    
    // Clean up master audio
    if (masterAudio.path && fs.existsSync(masterAudio.path)) {
      await fs.remove(masterAudio.path);
    }
    
    // Clean up video service temp files
    await videoServiceRefactored.cleanupTempVideos(scenesWithAudio);
    
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.warn('⚠️ Cleanup warning:', error.message);
  }
}

// Cleanup old projects (run periodically)
setInterval(async () => {
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
  
  // Also clean up old temp files
  await ttsServiceRefactored.cleanupOldAudioFiles();
  await videoServiceRefactored.cleanupOldTempFiles();
  
}, 60 * 60 * 1000); // Run every hour

module.exports = router;