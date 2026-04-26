const gtts = require('node-gtts');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

class TTSServiceRefactored {
  constructor() {
    this.tmpDir = path.join(__dirname, '..', 'tmp', 'audio');
    this.language = 'en';
    
    // Ensure audio directory exists
    fs.ensureDirSync(this.tmpDir);
  }

  /**
   * Main function to generate audio for all scenes sequentially
   * This ensures audio is generated properly BEFORE video processing
   */
  async generateAudioSequence(scenes) {
    try {
      console.log('🎤 Starting sequential audio generation for all scenes');
      console.log(`📊 Processing ${scenes.length} scenes for audio generation`);
      
      const scenesWithAudio = [];

      const speed = 170 + Math.random() * 20;
      const voices = ["Karen (Premium)", "Matilda (Premium)", "Zoe (Enhanced)"];
      const voice = voices[Math.floor(Math.random() * voices.length)];

      console.log(`🎶 using voice: ${voice}, speed: ${speed.toFixed(2)}`);

      
      // Process each scene sequentially (not parallel) to avoid conflicts
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        console.log(`\n🎙️ Generating audio for scene ${i + 1}/${scenes.length}`);
        console.log(`   Scene ID: ${scene.id || `scene_${i + 1}`}`);
        console.log(`   Text: "${scene.text?.substring(0, 100)}${scene.text?.length > 100 ? '...' : ''}"`);
        console.log(`   Target Duration: ${scene.duration}s`);
        
        try {
          const audioPath = await this.generateAudioForScene(scene, i, voice, speed);
          
          if (audioPath && fs.existsSync(audioPath)) {
            const actualDuration = await this.getAudioDuration(audioPath);
            console.log(`   ✅ Audio generated: ${path.basename(audioPath)} (${actualDuration.toFixed(2)}s)`);
            
            scenesWithAudio.push({
              ...scene,
              audioPath: audioPath,
              audioDuration: actualDuration
            });
          } else {
            throw new Error('Audio file was not created');
          }
          
        } catch (error) {
          console.error(`   ❌ Failed to generate audio for scene ${i + 1}:`, error.message);
          // Create silent audio as fallback
          const silentPath = await this.createSilentAudio(scene.duration, i);
          scenesWithAudio.push({
            ...scene,
            audioPath: silentPath,
            audioDuration: scene.duration,
            isSilent: true
          });
          console.log(`   🔇 Fallback silent audio created`);
        }
      }
      
      console.log(`\n✅ Audio sequence generation completed`);
      console.log(`📈 Successfully generated audio for ${scenesWithAudio.length} scenes`);
      
      // Generate summary
      const normalAudio = scenesWithAudio.filter(s => !s.isSilent).length;
      const silentAudio = scenesWithAudio.filter(s => s.isSilent).length;
      console.log(`   🎵 Normal audio: ${normalAudio} scenes`);
      console.log(`   🔇 Silent audio: ${silentAudio} scenes`);
      
      return scenesWithAudio;
    } catch (error) {
      console.error('❌ Audio sequence generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate audio for a single scene with exact duration matching
   */
  async generateAudioForScene(scene, sceneIndex, voice, speed) {
    try {
      const filename = `scene_${sceneIndex + 1}_${uuidv4()}.wav`;
      const filepath = path.join(this.tmpDir, filename);
      
      // Step 1: Generate audio with the best available method
      let audioResult;
      if (process.platform === 'darwin') {
        try {
          audioResult = await this.generateWithSay(scene.text, filepath, voice, speed);
        } catch (error) {
          console.log('   📝 macOS Say failed, using GTTS');
          audioResult = await this.generateWithGTTS(scene.text, filepath);
        }
      } else {
        audioResult = await this.generateWithGTTS(scene.text, filepath);
      }
      
      if (!audioResult || !audioResult.path) {
        throw new Error('Audio generation returned invalid result');
      }
      
      // Step 2: Adjust duration to EXACTLY match scene duration
      const adjustedPath = await this.ensureExactDuration(
        audioResult.path, 
        scene.duration, 
        sceneIndex
      );
      
      return adjustedPath;
    } catch (error) {
      console.error(`Error generating audio for scene ${sceneIndex + 1}:`, error.message);
      throw error;
    }
  }

  /**
   * Ensure audio matches EXACT scene duration using robust FFmpeg commands
   */
  async ensureExactDuration(audioPath, targetDuration, sceneIndex) {
    try {
      const actualDuration = await this.getAudioDuration(audioPath);
      const tolerance = 0.1; // 100ms tolerance
      
      if (Math.abs(actualDuration - targetDuration) < tolerance) {
        console.log(`   ⏱️ Duration OK: ${actualDuration.toFixed(2)}s ≈ ${targetDuration}s`);
        return audioPath;
      }
      
      const adjustedPath = path.join(this.tmpDir, `adjusted_${sceneIndex + 1}_${uuidv4()}.wav`);
      
      if (actualDuration < targetDuration) {
        // Audio too short - pad with silence
        await this.padAudioWithSilence(audioPath, adjustedPath, targetDuration);
        console.log(`   📏 Padded: ${actualDuration.toFixed(2)}s → ${targetDuration}s`);
      } else {
        // Audio too long - trim to exact duration
        await this.trimAudioToExactDuration(audioPath, adjustedPath, targetDuration);
        console.log(`   ✂️ Trimmed: ${actualDuration.toFixed(2)}s → ${targetDuration}s`);
      }
      
      // Clean up original
      await fs.remove(audioPath);
      return adjustedPath;
    } catch (error) {
      console.warn(`Failed to adjust audio duration: ${error.message}`);
      return audioPath; // Return original on adjustment failure
    }
  }

  /**
   * Pad audio with silence to reach target duration
   */
  async padAudioWithSilence(inputPath, outputPath, targetDuration) {
    const actualDuration = await this.getAudioDuration(inputPath);
    const silenceDuration = targetDuration - actualDuration;
    
    const command = `ffmpeg -i "${inputPath}" -f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=44100:duration=${silenceDuration}" -filter_complex "[0:a][1:a]concat=n=2:v=0:a=1[out]" -map "[out]" -ar 44100 -ac 2 -c:a pcm_s16le "${outputPath}" -y`;
    
    await execAsync(command);
  }

  /**
   * Trim audio to exact duration
   */
  async trimAudioToExactDuration(inputPath, outputPath, duration) {
    const command = `ffmpeg -i "${inputPath}" -t ${duration} -ar 44100 -ac 2 -c:a pcm_s16le "${outputPath}" -y`;
    await execAsync(command);
  }

  /**
   * Generate audio using macOS Say command (highest quality)
   */
  async generateWithSay(text, filepath, voice = 'Karen (Premium)', speed = 170) {
    try {
      const tempAiffPath = filepath.replace('.wav', '.aiff');
      
      // Use highest quality settings
      const command = `say -v ${voice} -r ${speed} -o "${tempAiffPath}" "${text}"`;
      await execAsync(command);
      
      // Convert to standard WAV format
      const convertCommand = `ffmpeg -i "${tempAiffPath}" -ar 44100 -ac 2 -c:a pcm_s16le "${filepath}" -y`;
      await execAsync(convertCommand);
      
      // Clean up temp file
      await fs.remove(tempAiffPath);
      
      const duration = await this.getAudioDuration(filepath);
      
      return {
        path: filepath,
        duration: duration,
        filename: path.basename(filepath)
      };
    } catch (error) {
      throw new Error(`Say TTS failed: ${error.message}`);
    }
  }

  /**
   * Generate audio using Google TTS (fallback method)
   */
  async generateWithGTTS(text, filepath) {
    return new Promise((resolve, reject) => {
      const tts = gtts(this.language);
      const tempMp3Path = filepath.replace('.wav', '.mp3');
      
      tts.save(tempMp3Path, text, async (err) => {
        if (err) {
          console.error('GTTS Error:', err);
          reject(err);
          return;
        }
        
        try {
          // Convert to standard WAV format with consistent settings
          const convertCommand = `ffmpeg -i "${tempMp3Path}" -ar 44100 -ac 2 -c:a pcm_s16le "${filepath}" -y`;
          await execAsync(convertCommand);
          
          // Clean up temp MP3
          await fs.remove(tempMp3Path);
          
          const duration = await this.getAudioDuration(filepath);
          
          resolve({
            path: filepath,
            duration: duration,
            filename: path.basename(filepath)
          });
        } catch (convertError) {
          console.error('Failed to convert GTTS audio:', convertError);
          reject(convertError);
        }
      });
    });
  }

  /**
   * Create silent audio for exact duration
   */
  async createSilentAudio(duration, sceneIndex) {
    const silentPath = path.join(this.tmpDir, `silent_${sceneIndex + 1}_${uuidv4()}.wav`);
    
    try {
      const command = `ffmpeg -f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=44100:duration=${duration}" -ar 44100 -ac 2 -c:a pcm_s16le "${silentPath}" -y`;
      await execAsync(command);
      
      console.log(`   🔇 Created silent audio: ${duration.toFixed(2)}s`);
      return silentPath;
    } catch (error) {
      console.error('Failed to create silent audio:', error);
      throw error;
    }
  }

  /**
   * Get accurate audio duration using ffprobe
   */
  async getAudioDuration(filepath) {
    try {
      const command = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filepath}"`;
      const { stdout } = await execAsync(command);
      const duration = parseFloat(stdout.trim());
      
      if (isNaN(duration) || duration <= 0) {
        throw new Error('Invalid duration returned');
      }
      
      return duration;
    } catch (error) {
      console.warn('Could not get audio duration via ffprobe, estimating...');
      return this.estimateAudioDuration(filepath);
    }
  }

  /**
   * Estimate audio duration as fallback
   */
  estimateAudioDuration(filepath) {
    // Fallback: estimate based on file size (very rough)
    try {
      const stats = fs.statSync(filepath);
      const fileSizeMB = stats.size / (1024 * 1024);
      // Rough estimate: 1MB ≈ 10 seconds for WAV
      return Math.max(1, fileSizeMB * 10);
    } catch (error) {
      return 5; // Default fallback
    }
  }

  /**
   * Combine multiple audio files into a single track (for final video)
   */
  async combineAllAudio(scenesWithAudio) {
    try {
      console.log('🔄 Combining all audio files into master track');
      
      const outputPath = path.join(this.tmpDir, `master_audio_${uuidv4()}.wav`);
      const fileListPath = path.join(this.tmpDir, `audio_list_${uuidv4()}.txt`);
      
      // Create file list for FFmpeg concat
      const fileList = scenesWithAudio
        .map(scene => `file '${path.resolve(scene.audioPath)}'`)
        .join('\n');
      
      await fs.writeFile(fileListPath, fileList);
      
      // Combine using concat demuxer
      const command = `ffmpeg -f concat -safe 0 -i "${fileListPath}" -c:a pcm_s16le -ar 44100 -ac 2 "${outputPath}" -y`;
      await execAsync(command);
      
      // Clean up file list
      await fs.remove(fileListPath);
      
      const totalDuration = await this.getAudioDuration(outputPath);
      console.log(`✅ Master audio track created: ${totalDuration.toFixed(2)}s`);
      
      return {
        path: outputPath,
        duration: totalDuration
      };
    } catch (error) {
      console.error('Error combining audio files:', error);
      throw error;
    }
  }

  /**
   * Clean up old audio files
   */
  async cleanupOldAudioFiles() {
    try {
      const files = await fs.readdir(this.tmpDir);
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      for (const file of files) {
        const filepath = path.join(this.tmpDir, file);
        const stats = await fs.stat(filepath);
        
        if (stats.mtime.getTime() < oneHourAgo) {
          await fs.remove(filepath);
          console.log(`🗑️ Cleaned up old audio: ${file}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up audio files:', error);
    }
  }

  /**
   * Validate TTS setup
   */
  validateTTSSetup() {
    try {
      return fs.existsSync(this.tmpDir);
    } catch (error) {
      console.error('TTS setup validation failed:', error);
      return false;
    }
  }
}

module.exports = new TTSServiceRefactored();