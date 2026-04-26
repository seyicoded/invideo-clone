const { spawn, exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = util.promisify(exec);

const ffmpegPath = process.env.FFMPEG_PATH || '/opt/homebrew/bin/ffmpeg';

class FFmpegUtil {
  constructor() {
    // FFmpeg path is set at the module level
  }

  async checkFFmpegInstallation() {
    try {
      await execAsync(`${ffmpegPath} -version`);
      console.log('✅ FFmpeg is installed and accessible');
      return true;
    } catch (error) {
      console.error('❌ FFmpeg not found. Please install FFmpeg.');
      console.error('Installation instructions:');
      console.error('macOS: brew install ffmpeg');
      console.error('Ubuntu: sudo apt update && sudo apt install ffmpeg');
      console.error('Windows: Download from https://ffmpeg.org/download.html');
      return false;
    }
  }

  async getVideoInfo(filePath) {
    try {
      const ffprobePath = ffmpegPath.replace('ffmpeg', 'ffprobe');
      const command = `${ffprobePath} -v quiet -print_format json -show_format -show_streams "${filePath}"`;
      const { stdout } = await execAsync(command);
      const metadata = JSON.parse(stdout);
      
      const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
      const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
      
      return {
        duration: parseFloat(metadata.format.duration) || 0,
        width: videoStream?.width || 0,
        height: videoStream?.height || 0,
        fps: videoStream ? eval(videoStream.r_frame_rate) : 0,
        bitrate: parseInt(metadata.format.bit_rate) || 0,
        hasAudio: !!audioStream,
        fileSize: parseInt(metadata.format.size) || 0,
        format: metadata.format.format_name
      };
    } catch (error) {
      throw new Error(`Failed to get video info: ${error.message}`);
    }
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

  async trimVideo(inputPath, outputPath, startTime, duration) {
    const args = [
      '-i', inputPath,
      '-ss', startTime.toString(),
      '-t', duration.toString(),
      '-c', 'copy', // Copy streams without re-encoding for speed
      '-y',
      outputPath
    ];
    
    try {
      await this.runFFmpeg(args);
      return outputPath;
    } catch (error) {
      throw new Error(`Failed to trim video: ${error.message}`);
    }
  }

  async resizeVideo(inputPath, outputPath, width, height) {
    const args = [
      '-i', inputPath,
      '-vf', `scale=${width}:${height},setsar=1:1`,
      '-aspect', '16:9',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-y',
      outputPath
    ];
    
    try {
      await this.runFFmpeg(args);
      return outputPath;
    } catch (error) {
      throw new Error(`Failed to resize video: ${error.message}`);
    }
  }

  async extractAudio(inputPath, outputPath) {
    const args = [
      '-i', inputPath,
      '-vn', // No video
      '-acodec', 'aac',
      '-y',
      outputPath
    ];
    
    try {
      await this.runFFmpeg(args);
      return outputPath;
    } catch (error) {
      throw new Error(`Failed to extract audio: ${error.message}`);
    }
  }

  async mergeAudioVideo(videoPath, audioPath, outputPath, options = {}) {
    let args = [
      '-i', videoPath,
      '-i', audioPath,
      '-c:v', 'copy', // Copy video stream
      '-c:a', 'aac', // Encode audio to AAC
      '-b:a', '256k', // Higher audio bitrate for better quality
      '-ar', '44100', // Audio sample rate
      '-ac', '2', // Stereo audio
      '-af', 'highpass=f=80,lowpass=f=8000,volume=1.1', // Audio filters for clarity
      '-y',
      outputPath
    ];
    
    if (options.matchLongest) {
      // Add filter_complex for matching longest stream
      args.splice(-2, 0, '-filter_complex', '[0:v][1:a]concat=n=1:v=1:a=1[outv][outa]', '-map', '[outv]', '-map', '[outa]');
    }
    
    try {
      await this.runFFmpeg(args);
      return outputPath;
    } catch (error) {
      throw new Error(`Failed to merge audio/video: ${error.message}`);
    }
  }

  async concatenateVideos(inputPaths, outputPath, options = {}) {
    // Build arguments for multiple inputs
    let args = [];
    
    // Add all inputs
    inputPaths.forEach(inputPath => {
      args.push('-i', inputPath);
    });
    
    // Create filter for concatenation with better audio handling
    const filterComplex = inputPaths
      .map((_, index) => `[${index}:v][${index}:a]`)
      .join('') + `concat=n=${inputPaths.length}:v=1:a=1[outv][outa]`;
    
    args = args.concat([
      '-filter_complex', filterComplex,
      '-map', '[outv]',
      '-map', '[outa]',
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-b:a', '256k', // Higher audio bitrate for better quality
      '-ar', '44100', // Consistent audio sample rate
      '-ac', '2', // Ensure stereo audio
      '-af', 'highpass=f=80,lowpass=f=8000,volume=1.1', // Audio enhancement filters
      '-preset', 'fast',
      '-y',
      outputPath
    ]);
    
    try {
      await this.runFFmpeg(args);
      return outputPath;
    } catch (error) {
      throw new Error(`Failed to concatenate videos: ${error.message}`);
    }
  }

  async addTextOverlay(inputPath, outputPath, text, options = {}) {
    const {
      fontSize = 32,
      fontColor = 'white',
      x = '(w-text_w)/2',
      y = '(h-text_h)/2',
      duration = null,
      backgroundColor = 'black@0.5'
    } = options;
    
    let drawTextFilter = `drawtext=text='${text}':fontcolor=${fontColor}:fontsize=${fontSize}:x=${x}:y=${y}`;
    
    if (backgroundColor) {
      drawTextFilter += `:box=1:boxcolor=${backgroundColor}:boxborderw=5`;
    }
    
    if (duration) {
      drawTextFilter += `:enable='between(t,0,${duration})'`;
    }
    
    const args = [
      '-i', inputPath,
      '-vf', drawTextFilter,
      '-c:a', 'copy', // Copy audio unchanged
      '-y',
      outputPath
    ];
    
    try {
      await this.runFFmpeg(args);
      return outputPath;
    } catch (error) {
      throw new Error(`Failed to add text overlay: ${error.message}`);
    }
  }

  async createColorBackground(width, height, duration, color, outputPath) {
    try {
      // Create both video and silent audio in one command for better sync
      const args = [
        '-f', 'lavfi',
        '-i', `color=c=${color}:s=${width}x${height}:d=${duration}:r=25`,
        '-f', 'lavfi', 
        '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-b:a', '256k', // Higher quality audio for background
        '-ar', '44100',
        '-ac', '2',
        '-preset', 'ultrafast',
        '-t', duration.toString(), // Ensure exact duration
        '-y',
        outputPath
      ];
      
      await this.runFFmpeg(args);
      return outputPath;
    } catch (error) {
      console.warn('lavfi method failed, trying alternative approach');
      return await this.createColorBackgroundAlternative(width, height, duration, color, outputPath);
    }
  }

  async createColorBackgroundAlternative(width, height, duration, color, outputPath) {
    // Create a simple 1-frame image and loop it
    const tempImagePath = outputPath.replace('.mp4', '_temp.png');
    
    try {
      // Try to use convert (ImageMagick) or fall back to a basic method
      await execAsync(`convert -size ${width}x${height} xc:"${color}" "${tempImagePath}"`);
      
      // Convert the image to video
      const args = [
        '-loop', '1',
        '-i', tempImagePath,
        '-t', duration.toString(),
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-pix_fmt', 'yuv420p',
        '-y',
        outputPath
      ];
      
      await this.runFFmpeg(args);
      
      // Clean up temp image
      fs.unlink(tempImagePath, () => {});
      return outputPath;
      
    } catch (error) {
      // Clean up temp image on error
      fs.unlink(tempImagePath, () => {});
      // Final fallback: use a basic FFmpeg approach without lavfi
      return await this.createBasicColorVideo(width, height, duration, color, outputPath);
    }
  }

  async createBasicColorVideo(width, height, duration, color, outputPath) {
    // Most basic approach - create a video with cross-platform fallback options
    return new Promise((resolve, reject) => {
      const os = require('os');
      let command;
      
      if (os.platform() === 'win32') {
        // Windows - use testsrc
        command = `ffmpeg -t ${duration} -f lavfi -i "testsrc=size=${width}x${height}:rate=1" -c:v libx264 -preset ultrafast -y "${outputPath}"`;
      } else {
        // Unix-like - try multiple approaches
        command = `ffmpeg -t ${duration} -f lavfi -i "color=c=${color}:s=${width}x${height}" -c:v libx264 -preset ultrafast -y "${outputPath}" 2>/dev/null || ffmpeg -t ${duration} -f lavfi -i "testsrc=size=${width}x${height}:rate=1" -c:v libx264 -preset ultrafast -y "${outputPath}"`;
      }
      
      require('child_process').exec(command, (error) => {
        if (error) {
          reject(new Error(`Failed to create basic color video: ${error.message}`));
        } else {
          resolve(outputPath);
        }
      });
    });
  }

  parseColorComponent(hexColor, component) {
    // Parse hex color like #FF0000 to individual RGB components (0-255)
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    switch(component) {
      case 'r': return r;
      case 'g': return g; 
      case 'b': return b;
      default: return 0;
    }
  }

  async fadeInOut(inputPath, outputPath, fadeInDuration = 1, fadeOutDuration = 1) {
    const args = [
      '-i', inputPath,
      '-vf', `fade=t=in:st=0:d=${fadeInDuration},fade=t=out:st=${fadeOutDuration}:d=${fadeOutDuration}`,
      '-y',
      outputPath
    ];
    
    try {
      await this.runFFmpeg(args);
      return outputPath;
    } catch (error) {
      throw new Error(`Failed to apply fade effects: ${error.message}`);
    }
  }

  async adjustVolume(inputPath, outputPath, volume = 1.0) {
    const args = [
      '-i', inputPath,
      '-af', `volume=${volume}`,
      '-y',
      outputPath
    ];
    
    try {
      await this.runFFmpeg(args);
      return outputPath;
    } catch (error) {
      throw new Error(`Failed to adjust volume: ${error.message}`);
    }
  }

  createProgressHandler(callback) {
    return (progress) => {
      if (progress.percent) {
        callback(Math.round(progress.percent));
      }
    };
  }

  async ensureMinimumDuration(inputPath, outputPath, minimumDuration = 600) {
    const videoInfo = await this.getVideoInfo(inputPath);
    const currentDuration = videoInfo.duration;
    
    if (currentDuration >= minimumDuration) {
      return inputPath; // Already meets minimum
    }
    
    console.log(`📏 Extending video from ${currentDuration}s to minimum ${minimumDuration}s`);
    
    const loopCount = Math.ceil(minimumDuration / currentDuration);
    const exactDuration = minimumDuration;
    
    // Create a file list for seamless looping
    const fileListPath = outputPath.replace('.mp4', '_loop.txt');
    
    try {
      // Generate loop entries
      let fileList = '';
      for (let i = 0; i < loopCount; i++) {
        fileList += `file '${path.resolve(inputPath)}'\n`;
      }
      
      fs.writeFileSync(fileListPath, fileList);
      
      const args = [
        '-f', 'concat',
        '-safe', '0', 
        '-i', fileListPath,
        '-t', exactDuration.toString(), // Cut to exact duration
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-b:a', '256k', // Higher quality audio for looped content
        '-ar', '44100',
        '-ac', '2',
        '-y',
        outputPath
      ];
      
      await this.runFFmpeg(args);
      
      // Clean up
      fs.unlink(fileListPath, () => {});
      return outputPath;
      
    } catch (error) {
      // Clean up on error
      fs.unlink(fileListPath, () => {});
      throw new Error(`Failed to extend video duration: ${error.message}`);
    }
  }

  async validateCodecs() {
    try {
      const { stdout } = await execAsync(`${ffmpegPath} -codecs`);
      
      const requiredCodecs = ['libx264', 'aac'];
      const hasRequired = requiredCodecs.every(codec => stdout.includes(codec));
      
      if (hasRequired) {
        console.log('✅ Required codecs available');
      } else {
        console.warn('⚠️ Some required codecs may not be available');
      }
      
      return hasRequired;
    } catch (error) {
      console.error('Error getting available codecs:', error);
      return false;
    }
  }
}

module.exports = new FFmpegUtil();