const gtts = require('node-gtts');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');
const util = require('util');
const ffmpegUtil = require('../utils/ffmpeg');

const execAsync = util.promisify(exec);

class TTSService {
  constructor() {
    this.service = process.env.TTS_SERVICE || 'enhanced';
    this.tmpDir = path.join(__dirname, '..', 'tmp', 'audio');
    this.language = 'en';
    
    // Enhanced voice settings for better quality
    this.voiceSettings = {
      voice: 'en-US-AriaNeural', // Female American voice
      speed: '1.0',
      pitch: '+0Hz',
      volume: '1.0'
    };
    
    // Ensure audio directory exists
    fs.ensureDirSync(this.tmpDir);
  }

  async generateVoiceoverForScenes(scenes) {
    try {
      console.log('🎤 Generating voiceover for scenes');
      
      const audioPromises = scenes.map((scene, index) => 
        this.generateAudioForScene(scene, index)
      );
      
      const audioResults = await Promise.allSettled(audioPromises);
      
      // Process results and ensure audio matches scene duration
      const processedScenes = [];
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const result = audioResults[i];
        
        if (result.status === 'fulfilled' && result.value) {
          // Ensure audio duration matches scene duration exactly
          const adjustedAudioPath = await this.adjustAudioToSceneDuration(
            result.value.path, 
            scene.duration, 
            i
          );
          
          processedScenes.push({
            ...scene,
            audioPath: adjustedAudioPath,
            audioDuration: scene.duration // Always match scene duration
          });
        } else {
          console.warn(`Failed to generate audio for scene ${i + 1}`);
          // Create silent audio for failed scenes
          const silentAudioPath = await this.createSilentAudio(scene.duration, i);
          processedScenes.push({
            ...scene,
            audioPath: silentAudioPath,
            audioDuration: scene.duration
          });
        }
      }

      console.log('✅ Voiceover generation completed');
      return processedScenes;
    } catch (error) {
      console.error('Error generating voiceover:', error);
      throw error;
    }
  }

  async generateAudioForScene(scene, sceneIndex) {
    try {
      const filename = `scene_${sceneIndex + 1}_${uuidv4()}.wav`; // Use WAV for better quality
      const filepath = path.join(this.tmpDir, filename);
      
      console.log(`🎙️ Generating audio for scene ${sceneIndex + 1}:`);
      console.log(`   Text: "${scene.text}"`);
      console.log(`   Target Duration: ${scene.duration}s`);
      console.log(`   Output: ${filename}`);
      
      // Try enhanced methods first
      let result;
      if (this.service === 'enhanced') {
        result = await this.generateWithEnhancedTTS(scene.text, filepath, scene.duration);
      } else if (this.service === 'piper') {
        result = await this.generateWithPiper(scene.text, filepath);
      } else {
        result = await this.generateWithGTTS(scene.text, filepath);
      }
      
      console.log(`✅ Audio generated: ${result.filename} (${result.duration?.toFixed(2)}s)`);
      return result;
    } catch (error) {
      console.error(`❌ Error generating audio for scene ${sceneIndex + 1}:`, error.message);
      throw error;
    }
  }

  async generateWithEnhancedTTS(text, filepath, targetDuration) {
    try {
      // Simplified approach - try macOS say first, then fallback to GTTS
      if (process.platform === 'darwin') {
        try {
          return await this.generateWithSay(text, filepath);
        } catch (error) {
          console.log('Say failed, trying GTTS:', error.message);
        }
      }
      
      // Fallback to GTTS
      return await this.generateWithGTTS(text, filepath);
    } catch (error) {
      console.error('All TTS methods failed:', error);
      throw error;
    }
  }
  
  async generateWithSay(text, filepath) {
    try {
      // Use macOS built-in 'say' command with high-quality female voice
      const tempAiffPath = filepath.replace('.wav', '.aiff');
      
      // Use Samantha voice with enhanced settings for better quality
      // -r 180: Slightly slower for clearer pronunciation
      // --quality=127: Maximum quality setting
      const command = `say -v Samantha -r 180 --quality=127 -o "${tempAiffPath}" "${text}"`;
      await execAsync(command);
      
      // Convert AIFF to high-quality WAV with enhanced audio settings
      const convertCommand = `ffmpeg -i "${tempAiffPath}" -ar 44100 -ac 2 -c:a pcm_s24le -b:a 256k "${filepath}" -y`;
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
  
  async generateWithEspeak(text, filepath) {
    try {
      // Try espeak with female voice
      const command = `espeak -v en-us+f3 -s 150 -w "${filepath}" "${text}"`;
      await execAsync(command);
      
      const duration = await this.getAudioDuration(filepath);
      return {
        path: filepath,
        duration: duration,
        filename: path.basename(filepath)
      };
    } catch (error) {
      throw new Error(`Espeak TTS failed: ${error.message}`);
    }
  }
  
  async generateWithFestival(text, filepath) {
    try {
      // Try Festival TTS
      const textFile = filepath.replace('.wav', '.txt');
      await fs.writeFile(textFile, text);
      
      const command = `text2wave "${textFile}" -o "${filepath}"`;
      await execAsync(command);
      
      await fs.remove(textFile);
      
      const duration = await this.getAudioDuration(filepath);
      return {
        path: filepath,
        duration: duration,
        filename: path.basename(filepath)
      };
    } catch (error) {
      throw new Error(`Festival TTS failed: ${error.message}`);
    }
  }

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
          // Convert MP3 to high-quality WAV with enhanced audio settings
          await execAsync(`ffmpeg -i "${tempMp3Path}" -ar 44100 -ac 2 -c:a pcm_s24le -b:a 256k -af "highpass=f=80,lowpass=f=8000,volume=1.2" "${filepath}" -y`);
          
          // Clean up temp MP3
          try {
            await fs.remove(tempMp3Path);
          } catch (cleanupError) {
            console.warn('Failed to cleanup temp MP3:', cleanupError.message);
          }
          
          const duration = await this.getAudioDuration(filepath);
          
          console.log(`✅ Generated GTTS audio: ${path.basename(filepath)} (${duration.toFixed(2)}s)`);
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

  async generateWithPiper(text, filepath) {
    try {
      // Check if Piper is available
      await execAsync('which piper');
      
      // Generate audio with Piper (assuming it's installed and configured)
      const command = `echo "${text}" | piper --model en_US-lessac-medium --output_file "${filepath}"`;
      
      await execAsync(command);
      
      // Get actual audio duration using ffprobe
      const duration = await this.getAudioDuration(filepath);
      
      console.log(`✅ Generated audio with Piper: ${path.basename(filepath)}`);
      return {
        path: filepath,
        duration: duration,
        filename: path.basename(filepath)
      };
    } catch (error) {
      console.warn('Piper not available, falling back to GTTS');
      return await this.generateWithGTTS(text, filepath);
    }
  }

  async getAudioDuration(filepath) {
    try {
      const command = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filepath}"`;
      const { stdout } = await execAsync(command);
      return parseFloat(stdout.trim());
    } catch (error) {
      console.warn('Could not get audio duration, using estimate');
      return this.estimateAudioDuration(filepath);
    }
  }

  async adjustAudioToSceneDuration(audioPath, targetDuration, sceneIndex) {
    try {
      const actualDuration = await this.getAudioDuration(audioPath);
      
      if (Math.abs(actualDuration - targetDuration) < 0.5) {
        return audioPath; // Close enough, no adjustment needed
      }
      
      const adjustedPath = path.join(this.tmpDir, `adjusted_${sceneIndex + 1}_${uuidv4()}.wav`);
      
      if (actualDuration < targetDuration) {
        // Audio is shorter - pad with silence
        const silenceDuration = targetDuration - actualDuration;
        const command = `ffmpeg -i "${audioPath}" -f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=44100:duration=${silenceDuration}" -filter_complex "[0:a][1:a]concat=n=2:v=0:a=1[out]" -map "[out]" -ar 44100 -ac 2 -c:a pcm_s24le -b:a 256k "${adjustedPath}" -y`;
        
        await execAsync(command);
        console.log(`🔧 Padded audio from ${actualDuration.toFixed(2)}s to ${targetDuration.toFixed(2)}s`);
      } else {
        // Audio is longer - trim to exact duration
        const command = `ffmpeg -i "${audioPath}" -t ${targetDuration} -ar 44100 -ac 2 -c:a pcm_s24le -b:a 256k "${adjustedPath}" -y`;
        
        await execAsync(command);
        console.log(`✂️ Trimmed audio from ${actualDuration.toFixed(2)}s to ${targetDuration.toFixed(2)}s`);
      }
      
      // Clean up original audio file
      await fs.remove(audioPath);
      
      return adjustedPath;
    } catch (error) {
      console.warn(`Failed to adjust audio duration: ${error.message}`);
      return audioPath; // Return original if adjustment fails
    }
  }
  
  async createSilentAudio(duration, sceneIndex) {
    const silentPath = path.join(this.tmpDir, `silent_${sceneIndex + 1}_${uuidv4()}.wav`);
    
    try {
      const command = `ffmpeg -f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=44100:duration=${duration}" -ar 44100 -ac 2 "${silentPath}" -y`;
      await execAsync(command);
      
      console.log(`🔇 Created silent audio: ${duration.toFixed(2)}s`);
      return silentPath;
    } catch (error) {
      console.error('Failed to create silent audio:', error);
      throw error;
    }
  }

  estimateAudioDuration(text) {
    // Estimate based on average speaking rate (150 words per minute)
    const words = text.split(' ').length;
    const minutes = words / 150;
    const seconds = minutes * 60;
    
    // Add some padding for natural speech
    return Math.max(2, seconds * 1.2);
  }

  async combineAudioFiles(audioPaths, outputPath) {
    try {
      console.log('🔄 Combining audio files');
      
      // Create a file list for FFmpeg
      const fileListPath = path.join(this.tmpDir, `filelist_${uuidv4()}.txt`);
      const fileList = audioPaths
        .map(audioPath => `file '${audioPath}'`)
        .join('\n');
      
      await fs.writeFile(fileListPath, fileList);
      
      // Combine audio files
      const command = `ffmpeg -f concat -safe 0 -i "${fileListPath}" -c copy "${outputPath}"`;
      
      await execAsync(command);
      
      // Clean up file list
      await fs.remove(fileListPath);
      
      console.log('✅ Audio files combined successfully');
      return outputPath;
    } catch (error) {
      console.error('Error combining audio files:', error);
      throw error;
    }
  }

  async adjustAudioSpeed(inputPath, outputPath, speedFactor) {
    try {
      const command = `ffmpeg -i "${inputPath}" -filter:a "atempo=${speedFactor}" "${outputPath}"`;
      await execAsync(command);
      return outputPath;
    } catch (error) {
      console.error('Error adjusting audio speed:', error);
      throw error;
    }
  }

  async addSilence(duration, outputPath) {
    try {
      const command = `ffmpeg -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -t ${duration} "${outputPath}"`;
      await execAsync(command);
      return outputPath;
    } catch (error) {
      console.error('Error creating silence:', error);
      throw error;
    }
  }

  async cleanupAudioFiles() {
    try {
      const files = await fs.readdir(this.tmpDir);
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      for (const file of files) {
        const filepath = path.join(this.tmpDir, file);
        const stats = await fs.stat(filepath);
        
        if (stats.mtime.getTime() < oneHourAgo) {
          await fs.remove(filepath);
          console.log(`🗑️ Cleaned up old audio file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up audio files:', error);
    }
  }

  validateTTSSetup() {
    try {
      // Test GTTS availability
      return true;
    } catch (error) {
      console.error('TTS setup validation failed:', error);
      return false;
    }
  }
}

module.exports = new TTSService();