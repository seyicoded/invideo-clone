const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ffmpegUtil = require('../utils/ffmpeg');

class VideoService {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'output');
    this.tmpDir = path.join(__dirname, '..', 'tmp');
    this.MINIMUM_DURATION = 600; // 10 minutes in seconds
    
    // Set FFmpeg path if specified in environment
    if (process.env.FFMPEG_PATH) {
      ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
    }
    
    // Ensure directories exist
    fs.ensureDirSync(this.outputDir);
    fs.ensureDirSync(this.tmpDir);
  }

  async createVideo(scenes, projectId) {
    try {
      console.log('🎬 Starting video creation process');
      
      // Validate scenes
      if (!scenes || scenes.length === 0) {
        throw new Error('No scenes provided for video creation');
      }

      // Calculate initial duration and adjust if needed FIRST
      let totalDuration = this.calculateTotalDuration(scenes);
      console.log(`📊 Initial total duration: ${totalDuration}s`);
      
      // If less than 10 minutes, extend scenes to meet minimum BEFORE processing
      if (totalDuration < this.MINIMUM_DURATION) {
        console.log(`⚠️ Video is ${totalDuration}s, extending to ${this.MINIMUM_DURATION}s minimum`);
        scenes = this.extendScenesForMinimum(scenes, this.MINIMUM_DURATION);
        totalDuration = this.calculateTotalDuration(scenes);
        console.log(`✅ Extended total duration: ${totalDuration}s`);
        console.log(`📋 Processing ${scenes.length} scenes (${scenes.filter(s => String(s.id || '').includes('extended')).length} extended)`);
      }

      // Process each scene to prepare video clips
      const processedClips = await this.processScenes(scenes);
      
      // Combine all clips into final video (should already be 10+ minutes)
      const finalVideoPath = await this.combineScenes(processedClips, projectId);
      
      console.log('✅ Video creation completed');
      return {
        videoPath: finalVideoPath,
        filename: path.basename(finalVideoPath),
        duration: totalDuration, // Use calculated duration, not recalculated
        scenes: processedClips
      };
    } catch (error) {
      console.error('Error creating video:', error);
      throw error;
    }
  }

  async processScenes(scenes) {
    const processedClips = [];
    
    console.log(`🎥 Processing ${scenes.length} scenes...`);
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      console.log(`🎬 Processing scene ${i + 1}/${scenes.length} - ID: ${scene.id}, Duration: ${scene.duration}s`);
      console.log(`   Text: "${scene.text?.substring(0, 100)}${scene.text?.length > 100 ? '...' : ''}"`);
      
      try {
        const clipPath = await this.createSceneClip(scene, i);
        processedClips.push({
          ...scene,
          clipPath: clipPath,
          processed: true
        });
        console.log(`✅ Scene ${i + 1} processed successfully`);
      } catch (error) {
        console.error(`❌ Error processing scene ${i + 1}:`, error.message);
        // Create a fallback clip
        const fallbackClip = await this.createFallbackClip(scene, i);
        processedClips.push({
          ...scene,
          clipPath: fallbackClip,
          processed: true,
          fallback: true
        });
        console.log(`🔧 Fallback clip created for scene ${i + 1}`);
      }
    }
    
    console.log(`📊 Processing clips summary:`);
    processedClips.forEach((clip, i) => {
      console.log(`   Scene ${i + 1}: ID=${clip.id}, Duration=${clip.duration}s, ${clip.fallback ? '(fallback)' : '(normal)'} - ${path.basename(clip.clipPath)}`);
    });
    
    return processedClips;
  }

  async createSceneClip(scene, index) {
    const tempFiles = []; // Track temporary files for cleanup
    
    return new Promise(async (resolve, reject) => {
      try {
        const outputPath = path.join(this.tmpDir, `scene_${index + 1}_${uuidv4()}.mp4`);
        
        let command = ffmpeg();
        
        // Add video input
        if (scene.mediaPath && fs.existsSync(scene.mediaPath)) {
          command = command.input(scene.mediaPath);
          
          // Set video duration and trim if necessary
          command = command
            .inputOptions('-ss 0') // Start from beginning
            .outputOptions(`-t ${scene.duration}`) // Set duration
            .outputOptions('-c:v libx264') // Video codec
            .outputOptions('-preset ultrafast') // Faster encoding
            .outputOptions('-crf 28') // Slightly lower quality for speed
            .videoFilter([
              'scale=1280:720:force_original_aspect_ratio=decrease', // Scale to 720p
              'pad=1280:720:(ow-iw)/2:(oh-ih)/2:black' // Add black bars if needed
            ]);
        } else {
          // Create a colored background if no media - use simpler approach
          const color = this.getSceneColor(scene.id || (index + 1)); // Provide fallback using index
          const tempBgPath = await this.createSimpleBackground(color, scene.duration, index);
          tempFiles.push(tempBgPath);
          command = command.input(tempBgPath);
        }
        
        // Add audio if available - SIMPLIFIED approach
        if (scene.audioPath && fs.existsSync(scene.audioPath)) {
          console.log(`🎧 Adding audio for scene ${index + 1}: ${path.basename(scene.audioPath)}`);
          command = command.input(scene.audioPath);
        } else {
          console.log(`🔇 No audio for scene ${index + 1}, will add silent audio`);
          // We'll add silent audio in post-processing to avoid filter complexity
        }
        
        // Simple approach - let FFmpeg handle the sync
        command = command
          .outputOptions('-c:v libx264')
          .outputOptions('-c:a aac')
          .outputOptions('-b:a 128k')
          .outputOptions('-ar 44100')
          .outputOptions('-ac 2')
          .outputOptions('-preset ultrafast')
          .outputOptions(`-t ${scene.duration}`) // Force exact duration

        // Skip text overlay for now to avoid filter issues
        // TODO: Add text overlay back once we have a more compatible method
        
        command
          .output(outputPath)
          .outputOptions('-y') // Overwrite output file
          .outputOptions('-avoid_negative_ts make_zero') // Fix audio sync
          .outputOptions('-fflags +genpts') // Generate presentation timestamps
          .on('end', () => {
            console.log(`✅ Scene ${index + 1} clip created: ${path.basename(outputPath)}`);
            // Clean up temporary files
            this.cleanupTempFiles(tempFiles);
            resolve(outputPath);
          })
          .on('error', (err) => {
            console.error(`Error creating scene ${index + 1} clip:`, err.message);
            // Clean up temporary files on error
            this.cleanupTempFiles(tempFiles);
            reject(err);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              console.log(`Scene ${index + 1} progress: ${Math.round(progress.percent)}%`);
            }
          })
          .run();
      } catch (error) {
        // Clean up temporary files if any error occurs during setup
        this.cleanupTempFiles(tempFiles);
        reject(error);
      }
    });
  }

  async createFallbackClip(scene, index) {
    const outputPath = path.join(this.tmpDir, `fallback_scene_${index + 1}_${uuidv4()}.mp4`);
    
    console.log(`🔧 Creating fallback clip for scene ${index + 1} (${scene.duration}s)`);
    
    return new Promise((resolve, reject) => {
      const color = this.getSceneColor(scene.id || 1); // Provide fallback for undefined id
      
      // Create simple colored background with silent audio
      ffmpeg()
        .input(`color=c=${color}:s=1280x720:d=${scene.duration}:r=25`)
        .inputOptions('-f lavfi')
        .input(`anullsrc=channel_layout=stereo:sample_rate=44100:duration=${scene.duration}`)
        .inputOptions('-f lavfi')
        .outputOptions('-c:v libx264')
        .outputOptions('-c:a aac')
        .outputOptions('-b:a 128k')
        .outputOptions('-ar 44100')
        .outputOptions('-ac 2')
        .outputOptions('-preset ultrafast')
        .output(outputPath)
        .outputOptions('-y')
        .on('end', () => {
          console.log(`✅ Fallback clip created: ${scene.duration}s`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error(`Fallback creation failed: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }

  async combineScenes(clips, projectId) {
    return new Promise(async (resolve, reject) => {
      try {
        const outputFilename = `video_${projectId}_${Date.now()}.mp4`;
        const outputPath = path.join(this.outputDir, outputFilename);
        
        console.log('🔄 Combining scenes into final video');
        console.log(`📊 Processing ${clips.length} scene clips`);
        
        // Validate all clips exist and get their info
        const validClips = [];
        for (let i = 0; i < clips.length; i++) {
          const clip = clips[i];
          if (clip.clipPath && fs.existsSync(clip.clipPath)) {
            try {
              // Quick validation that the file is readable
              const stats = await fs.stat(clip.clipPath);
              if (stats.size > 0) {
                validClips.push(clip);
                console.log(`✅ Clip ${i + 1}: ${path.basename(clip.clipPath)} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
              } else {
                console.warn(`⚠️ Clip ${i + 1} is empty, skipping`);
              }
            } catch (error) {
              console.warn(`⚠️ Clip ${i + 1} validation failed:`, error.message);
            }
          } else {
            console.warn(`⚠️ Clip ${i + 1} file not found: ${clip.clipPath}`);
          }
        }
        
        if (validClips.length === 0) {
          throw new Error('No valid clips found to combine');
        }
        
        console.log(`📹 Combining ${validClips.length} valid clips`);
        
        // Use a more robust concatenation approach
        if (validClips.length === 1) {
          // Single clip - just copy it
          await fs.copy(validClips[0].clipPath, outputPath);
          console.log(`✅ Single clip copied as final video: ${outputFilename}`);
          this.cleanupTempClips(clips);
          resolve(outputPath);
          return;
        }
        
        // Use file-based concatenation (more reliable than filter_complex)
        await this.concatenateWithFileList(validClips, outputPath);
        
        console.log(`✅ Final video created: ${outputFilename}`);
        this.cleanupTempClips(clips);
        resolve(outputPath);
        
      } catch (error) {
        console.error('Error in combineScenes:', error.message);
        reject(error);
      }
    });
  }

  async concatenateWithFileList(clips, outputPath) {
    return new Promise((resolve, reject) => {
      // Create a temporary file list for concatenation
      const fileListPath = path.join(this.tmpDir, `concat_${uuidv4()}.txt`);
      
      try {
        // Generate file list content
        const fileListContent = clips
          .map(clip => `file '${path.resolve(clip.clipPath)}'`)
          .join('\n');
        
        // Write the file list
        fs.writeFileSync(fileListPath, fileListContent);
        
        console.log(`📝 Created concat file list: ${clips.length} entries`);
        
        // Use concat demuxer with proper re-encoding for better compatibility
        const command = ffmpeg()
          .input(fileListPath)
          .inputOptions('-f concat')
          .inputOptions('-safe 0')
          .outputOptions('-c:v libx264') // Re-encode video for consistency
          .outputOptions('-c:a aac')     // Re-encode audio for consistency
          .outputOptions('-b:a 128k')    // Consistent audio bitrate
          .outputOptions('-ar 44100')    // Consistent sample rate
          .outputOptions('-ac 2')        // Consistent channel count
          .outputOptions('-preset fast') // Good speed/quality balance
          .outputOptions('-avoid_negative_ts make_zero') // Fix sync issues
          .outputOptions('-fflags +genpts') // Generate timestamps
          .output(outputPath)
          .outputOptions('-y')
          .on('end', () => {
            // Clean up the file list
            fs.remove(fileListPath).catch(() => {});
            console.log('✅ Video concatenation completed');
            resolve(outputPath);
          })
          .on('error', (err) => {
            console.error('Concatenation failed:', err.message);
            // Clean up and try alternative method
            fs.remove(fileListPath).catch(() => {});
            reject(err); // Don't fall back - fix the root cause
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              console.log(`Concatenation progress: ${Math.round(progress.percent)}%`);
            }
          })
          .run();
          
      } catch (error) {
        // Clean up file list on setup error
        fs.remove(fileListPath).catch(() => {});
        reject(error);
      }
    });
  }

  createTextFilter(text, duration) {
    // Clean text for FFmpeg
    const cleanText = text.replace(/'/g, "\\'").replace(/"/g, '\\"');
    
    return [
      'scale=1280:720:force_original_aspect_ratio=decrease',
      'pad=1280:720:(ow-iw)/2:(oh-ih)/2:black',
      `drawtext=text='${cleanText}':fontcolor=white:fontsize=32:box=1:boxcolor=black@0.5:boxborderw=5:x=(w-text_w)/2:y=(h-text_h-50):enable='between(t,0,${Math.min(duration, 5)})'`
    ];
  }

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
      // Extract number from string like "extended_5" or use hash
      const match = sceneId.match(/\d+/);
      numericId = match ? parseInt(match[0]) : sceneId.length; // fallback to string length
    } else {
      numericId = parseInt(sceneId) || 1; // fallback to 1 if not a valid number
    }
    
    return colors[(numericId - 1) % colors.length];
  }

  extendScenesForMinimum(scenes, minimumDuration) {
    const currentDuration = this.calculateTotalDuration(scenes);
    if (currentDuration >= minimumDuration) {
      return scenes; // Already meets minimum
    }
    
    const extensionNeeded = minimumDuration - currentDuration;
    console.log(`📈 Need to add ${extensionNeeded}s more content`);
    
    // Strategy: Extend each scene proportionally, then add duplicates if needed
    const extendedScenes = [...scenes];
    
    // First, extend existing scenes by reasonable amounts (max 30s per scene)
    const maxExtensionPerScene = Math.min(30, extensionNeeded / scenes.length);
    let totalExtended = 0;
    
    for (let i = 0; i < extendedScenes.length; i++) {
      const currentSceneDuration = extendedScenes[i].duration || 5;
      const extension = Math.min(maxExtensionPerScene, extensionNeeded - totalExtended);
      
      extendedScenes[i] = {
        ...extendedScenes[i],
        duration: currentSceneDuration + extension
      };
      
      totalExtended += extension;
      console.log(`📏 Extended scene ${i + 1} from ${currentSceneDuration}s to ${extendedScenes[i].duration}s`);
      
      if (totalExtended >= extensionNeeded) break;
    }
    
    // If still not enough, duplicate scenes
    let currentTotal = this.calculateTotalDuration(extendedScenes);
    let duplicateCount = 0;
    
    while (currentTotal < minimumDuration && duplicateCount < scenes.length * 3) { // Safety limit
      const originalScene = scenes[duplicateCount % scenes.length];
      const remainingTime = minimumDuration - currentTotal;
      const sceneDuration = Math.min(originalScene.duration || 5, remainingTime);
      
      const duplicateScene = {
        ...originalScene,
        id: `extended_${extendedScenes.length + 1}`, // Ensure this is always a string
        duration: sceneDuration
      };
      
      extendedScenes.push(duplicateScene);
      currentTotal += sceneDuration;
      duplicateCount++;
      
      console.log(`🔄 Added duplicate scene ${duplicateCount}: ${sceneDuration}s`);
    }
    
    const finalDuration = this.calculateTotalDuration(extendedScenes);
    console.log(`✅ Extended from ${scenes.length} scenes (${currentDuration}s) to ${extendedScenes.length} scenes (${finalDuration}s)`);
    return extendedScenes;
  }
  
  calculateTotalDuration(scenes) {
    return scenes.reduce((total, scene) => total + (scene.duration || 5), 0);
  }

  async cleanupTempFiles(filePaths) {
    for (const filePath of filePaths) {
      try {
        if (filePath && fs.existsSync(filePath)) {
          await fs.remove(filePath);
          console.log(`🗑️ Cleaned up temp file: ${path.basename(filePath)}`);
        }
      } catch (error) {
        console.warn(`Failed to cleanup temp file ${filePath}:`, error.message);
      }
    }
  }

  async cleanupTempClips(clips) {
    try {
      for (const clip of clips) {
        if (clip.clipPath && fs.existsSync(clip.clipPath)) {
          await fs.remove(clip.clipPath);
          console.log(`🗑️ Cleaned up temp clip: ${path.basename(clip.clipPath)}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up temp clips:', error);
    }
  }

  async getVideoInfo(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        
        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
        
        resolve({
          duration: metadata.format.duration,
          width: videoStream ? videoStream.width : null,
          height: videoStream ? videoStream.height : null,
          hasAudio: !!audioStream,
          fileSize: metadata.format.size
        });
      });
    });
  }

  async createSimpleBackground(color, duration, sceneIndex) {
    const backgroundPath = path.join(this.tmpDir, `simple_bg_${sceneIndex + 1}_${uuidv4()}.mp4`);
    
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      
      // Create the simplest possible solid color video using basic FFmpeg
      // Try multiple approaches for maximum compatibility
      const commands = [
        // Method 1: Use rawvideo with pad filter (most compatible)
        `ffmpeg -f rawvideo -video_size 1280x720 -pixel_format rgb24 -framerate 1 -t ${duration} -i /dev/zero -vf "pad=1280:720:0:0:${color}" -c:v libx264 -preset ultrafast -pix_fmt yuv420p -y "${backgroundPath}" 2>/dev/null`,
        // Method 2: Basic black background 
        `ffmpeg -f rawvideo -video_size 1280x720 -pixel_format rgb24 -framerate 1 -t ${duration} -i /dev/zero -c:v libx264 -preset ultrafast -pix_fmt yuv420p -y "${backgroundPath}" 2>/dev/null`,
        // Method 3: Create image and convert to video (most compatible fallback)
        `ffmpeg -t ${duration} -loop 1 -i /System/Library/Desktop\\ Pictures/Solid\\ Colors/Solid\\ Gray\\ Pro\\ Ultra\\ Dark.png -c:v libx264 -preset ultrafast -pix_fmt yuv420p -y "${backgroundPath}" 2>/dev/null || ffmpeg -f rawvideo -video_size 1280x720 -pixel_format gray -framerate 1 -t ${duration} -i /dev/zero -c:v libx264 -preset ultrafast -pix_fmt yuv420p -y "${backgroundPath}"`
      ];
      
      // Try commands in order until one succeeds
      const tryCommand = (commandIndex) => {
        if (commandIndex >= commands.length) {
          reject(new Error('All background creation methods failed'));
          return;
        }
        
        exec(commands[commandIndex], (error, stdout, stderr) => {
          if (error || !fs.existsSync(backgroundPath)) {
            console.warn(`Background method ${commandIndex + 1} failed, trying next...`);
            tryCommand(commandIndex + 1);
          } else {
            console.log(`✅ Created background using method ${commandIndex + 1}`);
            resolve(backgroundPath);
          }
        });
      };
      
      tryCommand(0);
    });
  }

  hexToNormalized(hexColor) {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    return { r, g, b };
  }

  async validateFFmpeg() {
    return new Promise((resolve) => {
      // Use a more basic validation that doesn't rely on lavfi
      const { exec } = require('child_process');
      
      exec('ffmpeg -version', (error, stdout) => {
        if (error) {
          console.error('❌ FFmpeg validation failed:', error.message);
          resolve(false);
        } else {
          console.log('✅ FFmpeg validation successful');
          resolve(true);
        }
      });
    });
  }
  
  async createBasicBackground(color, duration, sceneIndex, backgroundPath) {
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      
      // Fallback: Create basic background with silent audio
      const command = `ffmpeg -f rawvideo -video_size 1280x720 -pixel_format rgb24 -framerate 25 -t ${duration} -i /dev/zero -f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=44100:duration=${duration}" -c:v libx264 -c:a aac -b:a 128k -ar 44100 -ac 2 -preset ultrafast -pix_fmt yuv420p -y "${backgroundPath}"`;
      
      exec(command, (error) => {
        if (error) {
          reject(new Error(`Failed to create basic background: ${error.message}`));
        } else {
          console.log(`✅ Created basic background with audio`);
          resolve(backgroundPath);
        }
      });
    });
  }
}

module.exports = new VideoService();