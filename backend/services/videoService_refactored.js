const { spawn, exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const util = require('util');

const ffmpegPath = process.env.FFMPEG_PATH || '/opt/homebrew/bin/ffmpeg';

const execAsync = util.promisify(exec);

class VideoServiceRefactored {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'output');
    this.tmpDir = path.join(__dirname, '..', 'tmp', 'videos');
    this.MINIMUM_DURATION = 600; // 10 minutes
    
    // Ensure directories exist
    fs.ensureDirSync(this.outputDir);
    fs.ensureDirSync(this.tmpDir);
  }

  /**
   * Helper function to run ffmpeg with spawn
   */
  runFFmpeg(args, options = {}) {
    return new Promise((resolve, reject) => {
      console.log(`Running FFmpeg: ${ffmpegPath} ${args.join(' ')}`);
      
      const ffmpegProcess = spawn(ffmpegPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        ...options
      });
      
      let stdout = '';
      let stderr = '';
      
      ffmpegProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      ffmpegProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        // Parse progress from stderr if callback provided
        if (options.onProgress) {
          const progressMatch = stderr.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
          if (progressMatch) {
            options.onProgress(progressMatch[1]);
          }
        }
      });
      
      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`FFmpeg process exited with code ${code}: ${stderr}`));
        }
      });
      
      ffmpegProcess.on('error', (error) => {
        reject(new Error(`FFmpeg process error: ${error.message}`));
      });
    });
  }

  /**
   * Main function: Create video AROUND the pre-generated audio
   * This follows the new flow: Script → Scenes → Audio → Video
   */
  async createVideoFromAudio(scenesWithAudio, masterAudio, projectId) {
    try {
      console.log('🎬 Starting video creation based on pre-generated audio');
      console.log(`📊 Processing ${scenesWithAudio.length} scenes with audio`);
      console.log(`🎵 Master audio duration: ${masterAudio.duration.toFixed(2)}s`);
      
      // Step 1: Process scenes to create video clips that match audio timing
      const processedScenes = await this.createVideoClipsForAudio(scenesWithAudio);
      
      // Step 2: Combine video clips
      const silentVideoPath = await this.combineVideoClips(processedScenes, projectId);
      
      // Step 3: Add the master audio track
      const finalVideoPath = await this.addMasterAudioToVideo(silentVideoPath, masterAudio, projectId);
      
      // Step 4: Ensure minimum duration (if needed)
      const finalOutputPath = await this.ensureMinimumDuration(finalVideoPath, projectId);
      
      console.log('✅ Video creation completed successfully');
      return {
        videoPath: finalOutputPath,
        filename: path.basename(finalOutputPath),
        duration: Math.max(masterAudio.duration, this.MINIMUM_DURATION),
        scenes: processedScenes.length
      };
    } catch (error) {
      console.error('❌ Video creation failed:', error);
      throw error;
    }
  }

  /**
   * Create video clips that exactly match the audio timing for each scene
   */
  async createVideoClipsForAudio(scenesWithAudio) {
    console.log('🎥 Creating video clips to match audio timing');
    
    const processedScenes = [];
    
    for (let i = 0; i < scenesWithAudio.length; i++) {
      const scene = scenesWithAudio[i];
      console.log(`\n🎬 Creating video clip ${i + 1}/${scenesWithAudio.length}`);
      console.log(`   Scene ID: ${scene.id || `scene_${i + 1}`}`);
      console.log(`   Audio Duration: ${scene.audioDuration?.toFixed(2) || scene.duration}s`);
      
      try {
        const videoClipPath = await this.createVideoClipForScene(scene, i);
        
        if (videoClipPath && fs.existsSync(videoClipPath)) {
          console.log(`   ✅ Video clip created: ${path.basename(videoClipPath)}`);
          processedScenes.push({
            ...scene,
            videoClipPath: videoClipPath
          });
        } else {
          throw new Error('Video clip was not created');
        }
        
      } catch (error) {
        console.error(`   ❌ Failed to create video clip for scene ${i + 1}:`, error.message);
        // Create fallback video clip
        const fallbackClip = await this.createFallbackVideoClip(scene, i);
        processedScenes.push({
          ...scene,
          videoClipPath: fallbackClip,
          isFallback: true
        });
        console.log(`   🔧 Fallback video clip created`);
      }
    }
    
    console.log(`\n✅ Video clip creation completed for ${processedScenes.length} scenes`);
    return processedScenes;
  }

  /**
   * Create a video clip for a single scene with EXACT audio duration matching
   */
  async createVideoClipForScene(scene, sceneIndex) {
    const outputPath = path.join(this.tmpDir, `scene_${sceneIndex + 1}_${uuidv4()}.mp4`);
    const duration = scene.audioDuration || scene.duration;
    
    try {
      let args = [];
      
      // Step 1: Determine video source (media or colored background)
      if (scene.mediaPath && fs.existsSync(scene.mediaPath)) {
        console.log(`   🎥 Using media: ${path.basename(scene.mediaPath)}`);
        args = [
          '-i', scene.mediaPath,
          '-f', 'lavfi',
          '-i', `anullsrc=channel_layout=stereo:sample_rate=44100:duration=${duration}`,
          '-t', duration.toString(), // EXACT duration
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-ar', '44100',
          '-ac', '2',
          '-avoid_negative_ts', 'make_zero',
          '-y',
          outputPath
        ];
      } else {
        console.log(`   🎨 Creating background for scene ${sceneIndex + 1}`);
        const color = this.getSceneColor(scene.id || (sceneIndex + 1));
        
        args = [
          '-f', 'lavfi',
          '-i', `color=c=${color}:s=1280x720:d=${duration}:r=25`,
          '-f', 'lavfi',
          '-i', `anullsrc=channel_layout=stereo:sample_rate=44100:duration=${duration}`,
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-ar', '44100',
          '-ac', '2',
          '-avoid_negative_ts', 'make_zero',
          '-y',
          outputPath
        ];
      }
      
      await this.runFFmpeg(args, {
        onProgress: (timeStr) => {
          // Basic progress logging - could be enhanced
          console.log(`   Progress: ${timeStr}`);
        }
      });
      
      return outputPath;
      
    } catch (error) {
      console.error(`Error creating video clip: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a simple fallback video clip
   */
  async createFallbackVideoClip(scene, sceneIndex) {
    const outputPath = path.join(this.tmpDir, `fallback_${sceneIndex + 1}_${uuidv4()}.mp4`);
    const duration = scene.audioDuration || scene.duration;
    const color = this.getSceneColor(scene.id || (sceneIndex + 1));
    
    console.log(`   🔧 Creating fallback clip: ${duration}s, color: ${color}`);
    
    try {
      const args = [
        '-f', 'lavfi',
        '-i', `color=c=${color}:s=1280x720:d=${duration}:r=25`,
        '-f', 'lavfi',
        '-i', `anullsrc=channel_layout=stereo:sample_rate=44100:duration=${duration}`,
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'ultrafast',
        '-y',
        outputPath
      ];
      
      await this.runFFmpeg(args);
      return outputPath;
    } catch (error) {
      throw new Error(`Failed to create fallback clip: ${error.message}`);
    }
  }

  /**
   * Combine all video clips into a single silent video
   */
  async combineVideoClips(processedScenes, projectId) {
    console.log('🔄 Combining video clips into silent master video');
    
    const silentVideoPath = path.join(this.tmpDir, `silent_video_${projectId}.mp4`);
    const fileListPath = path.join(this.tmpDir, `video_list_${uuidv4()}.txt`);
    
    try {
      // Create file list for FFmpeg concat
      const fileList = processedScenes
        .map(scene => `file '${path.resolve(scene.videoClipPath)}'`)
        .join('\n');
      
      await fs.writeFile(fileListPath, fileList);
      
      // Use simple concat demuxer
      const command = `ffmpeg -loglevel error -f concat -safe 0 -i "${fileListPath}" -c:v copy -c:a copy "${silentVideoPath}" -y`;
      await execAsync(command);
      
      // Clean up
      await fs.remove(fileListPath);
      
      console.log(`✅ Silent video created: ${path.basename(silentVideoPath)}`);
      return silentVideoPath;
    } catch (error) {
      // Clean up on error
      fs.remove(fileListPath).catch(() => {});
      throw new Error(`Failed to combine video clips: ${error.message}`);
    }
  }

  /**
   * Add the master audio track to the combined video
   */
  async addMasterAudioToVideo(silentVideoPath, masterAudio, projectId) {
    console.log('🎵 Adding master audio track to video');
    
    const videoWithAudioPath = path.join(this.outputDir, `video_with_audio_${projectId}.mp4`);
    
    try {
      const args = [
        '-i', silentVideoPath,
        '-i', masterAudio.path,
        '-c:v', 'copy', // Don't re-encode video
        '-c:a', 'aac',  // Encode audio to AAC
        '-b:a', '256k', // High quality audio
        '-ar', '44100',
        '-ac', '2',
        '-map', '0:v',  // Map video from first input
        '-map', '1:a',  // Map audio from second input
        '-shortest', // Match shortest stream (should be equal)
        '-y',
        videoWithAudioPath
      ];
      
      await this.runFFmpeg(args, {
        onProgress: (timeStr) => {
          console.log(`Audio sync progress: ${timeStr}`);
        }
      });
      
      console.log(`✅ Audio added to video: ${path.basename(videoWithAudioPath)}`);
      
      // Clean up silent video
      fs.remove(silentVideoPath).catch(() => {});
      
      return videoWithAudioPath;
    } catch (error) {
      console.error(`Failed to add audio: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ensure the final video meets minimum duration requirement
   */
  async ensureMinimumDuration(videoPath, projectId) {
    try {
      const videoDuration = await this.getVideoDuration(videoPath);
      
      if (videoDuration >= this.MINIMUM_DURATION) {
        console.log(`✅ Video duration OK: ${videoDuration.toFixed(2)}s >= ${this.MINIMUM_DURATION}s`);
        return videoPath;
      }
      
      console.log(`📏 Extending video from ${videoDuration.toFixed(2)}s to ${this.MINIMUM_DURATION}s`);
      const extendedVideoPath = path.join(this.outputDir, `video_extended_${projectId}.mp4`);
      
      await this.extendVideoToMinimum(videoPath, extendedVideoPath, this.MINIMUM_DURATION);
      
      // Clean up original
      await fs.remove(videoPath);
      
      return extendedVideoPath;
    } catch (error) {
      console.warn(`Failed to extend video duration: ${error.message}`);
      return videoPath; // Return original if extension fails
    }
  }

  /**
   * Extend video to minimum duration by looping
   */
  async extendVideoToMinimum(inputPath, outputPath, targetDuration) {
    const originalDuration = await this.getVideoDuration(inputPath);
    const loopCount = Math.ceil(targetDuration / originalDuration);
    
    const fileListPath = path.join(this.tmpDir, `extend_list_${uuidv4()}.txt`);
    
    try {
      // Create file list with repetitions
      const fileListContent = Array(loopCount)
        .fill(`file '${path.resolve(inputPath)}'`)
        .join('\n');
      
      await fs.writeFile(fileListPath, fileListContent);
      
      // Concatenate and cut to exact duration
      const command = `ffmpeg -f concat -safe 0 -i "${fileListPath}" -t ${targetDuration} -c:v copy -c:a aac -b:a 256k "${outputPath}" -y`;
      await execAsync(command);
      
      // Clean up
      await fs.remove(fileListPath);
      
      console.log(`✅ Video extended to ${targetDuration}s`);
    } catch (error) {
      fs.remove(fileListPath).catch(() => {});
      throw error;
    }
  }

  /**
   * Get video duration using ffprobe
   */
  async getVideoDuration(videoPath) {
    try {
      const command = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${videoPath}"`;
      const { stdout } = await execAsync(command);
      const duration = parseFloat(stdout.trim());
      
      if (isNaN(duration) || duration <= 0) {
        throw new Error('Invalid duration returned');
      }
      
      return duration;
    } catch (error) {
      console.warn('Could not get video duration:', error.message);
      return 0;
    }
  }

  /**
   * Get scene color based on scene ID
   */
  getSceneColor(sceneId) {
    const colors = [
      '#2C3E50', // Dark blue-gray
      '#34495E', // Dark gray
      '#7F8C8D', // Gray
      '#95A5A6', // Light gray
      '#BDC3C7', // Very light gray
      '#ECF0F1'  // Almost white
    ];
    
    // Handle both numeric and string IDs
    let numericId;
    if (typeof sceneId === 'string') {
      const match = sceneId.match(/\d+/);
      numericId = match ? parseInt(match[0]) : sceneId.length;
    } else {
      numericId = parseInt(sceneId) || 1;
    }
    
    return colors[(numericId - 1) % colors.length];
  }

  /**
   * Clean up temporary video files
   */
  async cleanupTempVideos(processedScenes) {
    try {
      for (const scene of processedScenes) {
        if (scene.videoClipPath && fs.existsSync(scene.videoClipPath)) {
          await fs.remove(scene.videoClipPath);
          console.log(`🗑️ Cleaned up: ${path.basename(scene.videoClipPath)}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up temp videos:', error);
    }
  }

  /**
   * Clean up old temporary files
   */
  async cleanupOldTempFiles() {
    try {
      const dirs = [this.tmpDir, path.join(__dirname, '..', 'tmp', 'audio')];
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      for (const dir of dirs) {
        if (fs.existsSync(dir)) {
          const files = await fs.readdir(dir);
          
          for (const file of files) {
            const filepath = path.join(dir, file);
            const stats = await fs.stat(filepath);
            
            if (stats.mtime.getTime() < oneHourAgo) {
              await fs.remove(filepath);
              console.log(`🗑️ Cleaned up old temp file: ${file}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up old temp files:', error);
    }
  }
}

module.exports = new VideoServiceRefactored();