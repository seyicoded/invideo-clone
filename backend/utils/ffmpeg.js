const ffmpeg = require('fluent-ffmpeg');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

class FFmpegUtil {
  constructor() {
    // Set FFmpeg path if specified in environment
    if (process.env.FFMPEG_PATH) {
      ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
    }
  }

  async checkFFmpegInstallation() {
    try {
      await execAsync('ffmpeg -version');
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
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(new Error(`Failed to get video info: ${err.message}`));
          return;
        }
        
        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
        
        resolve({
          duration: parseFloat(metadata.format.duration) || 0,
          width: videoStream?.width || 0,
          height: videoStream?.height || 0,
          fps: videoStream ? eval(videoStream.r_frame_rate) : 0,
          bitrate: parseInt(metadata.format.bit_rate) || 0,
          hasAudio: !!audioStream,
          fileSize: parseInt(metadata.format.size) || 0,
          format: metadata.format.format_name
        });
      });
    });
  }

  async trimVideo(inputPath, outputPath, startTime, duration) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(startTime)
        .duration(duration)
        .output(outputPath)
        .outputOptions('-c copy') // Copy streams without re-encoding for speed
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  async resizeVideo(inputPath, outputPath, width, height) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .size(`${width}x${height}`)
        .aspect('16:9')
        .output(outputPath)
        .outputOptions('-c:v libx264')
        .outputOptions('-preset fast')
        .outputOptions('-crf 23')
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  async extractAudio(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .noVideo()
        .audioCodec('aac')
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  async mergeAudioVideo(videoPath, audioPath, outputPath, options = {}) {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .outputOptions('-c:v copy') // Copy video stream
        .outputOptions('-c:a aac') // Encode audio to AAC
        .outputOptions('-b:a 256k') // Higher audio bitrate for better quality
        .outputOptions('-ar 44100') // Audio sample rate
        .outputOptions('-ac 2') // Stereo audio
        .outputOptions('-af highpass=f=80,lowpass=f=8000,volume=1.1') // Audio filters for clarity
        // Remove -shortest to prevent audio cutoff
        .outputOptions(options.matchLongest ? '-filter_complex [0:v][1:a]concat=n=1:v=1:a=1[outv][outa] -map [outv] -map [outa]' : '')
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  async concatenateVideos(inputPaths, outputPath, options = {}) {
    return new Promise((resolve, reject) => {
      let command = ffmpeg();
      
      // Add all inputs
      inputPaths.forEach(path => {
        command = command.input(path);
      });
      
      // Create filter for concatenation with better audio handling
      const filterComplex = inputPaths
        .map((_, index) => `[${index}:v][${index}:a]`)
        .join('') + `concat=n=${inputPaths.length}:v=1:a=1[outv][outa]`;
      
      command
        .complexFilter(filterComplex)
        .outputOptions('-map [outv]')
        .outputOptions('-map [outa]')
        .outputOptions('-c:v libx264')
        .outputOptions('-c:a aac')
        .outputOptions('-b:a 256k') // Higher audio bitrate for better quality
        .outputOptions('-ar 44100') // Consistent audio sample rate
        .outputOptions('-ac 2') // Ensure stereo audio
        .outputOptions('-af highpass=f=80,lowpass=f=8000,volume=1.1') // Audio enhancement filters
        .outputOptions('-preset fast')
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
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
    
    return new Promise((resolve, reject) => {
      let drawTextFilter = `drawtext=text='${text}':fontcolor=${fontColor}:fontsize=${fontSize}:x=${x}:y=${y}`;
      
      if (backgroundColor) {
        drawTextFilter += `:box=1:boxcolor=${backgroundColor}:boxborderw=5`;
      }
      
      if (duration) {
        drawTextFilter += `:enable='between(t,0,${duration})'`;
      }
      
      ffmpeg(inputPath)
        .videoFilter(drawTextFilter)
        .output(outputPath)
        .outputOptions('-c:a copy') // Copy audio unchanged
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  async createColorBackground(width, height, duration, color, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        // Create both video and silent audio in one command for better sync
        ffmpeg()
          .input(`color=c=${color}:s=${width}x${height}:d=${duration}:r=25`)
          .inputOptions('-f lavfi')
          .input('anullsrc=channel_layout=stereo:sample_rate=44100')
          .inputOptions('-f lavfi')
          .outputOptions('-c:v libx264')
          .outputOptions('-c:a aac')
          .outputOptions('-b:a 256k') // Higher quality audio for background
          .outputOptions('-ar 44100')
          .outputOptions('-ac 2')
          .outputOptions('-preset ultrafast')
          .outputOptions(`-t ${duration}`) // Ensure exact duration
          .output(outputPath)
          .on('end', () => resolve(outputPath))
          .on('error', (err) => {
            console.warn('lavfi method failed, trying alternative approach');
            this.createColorBackgroundAlternative(width, height, duration, color, outputPath)
              .then(resolve)
              .catch(reject);
          })
          .run();
      } catch (error) {
        this.createColorBackgroundAlternative(width, height, duration, color, outputPath)
          .then(resolve)
          .catch(reject);
      }
    });
  }

  async createColorBackgroundAlternative(width, height, duration, color, outputPath) {
    // Create a simple 1-frame image and loop it
    const tempImagePath = outputPath.replace('.mp4', '_temp.png');
    
    return new Promise((resolve, reject) => {
      // Create a solid color image using ImageMagick convert or similar
      const { exec } = require('child_process');
      
      // Try to use convert (ImageMagick) or fall back to a basic method
      exec(`convert -size ${width}x${height} xc:"${color}" "${tempImagePath}"`, (error) => {
        if (error) {
          // Final fallback: use a basic FFmpeg approach without lavfi
          this.createBasicColorVideo(width, height, duration, color, outputPath)
            .then(resolve)
            .catch(reject);
          return;
        }
        
        // Convert the image to video
        ffmpeg()
          .input(tempImagePath)
          .inputOptions(['-loop', '1'])
          .outputOptions(['-t', duration.toString()])
          .outputOptions('-c:v libx264')
          .outputOptions('-preset ultrafast')
          .outputOptions('-pix_fmt yuv420p')
          .output(outputPath)
          .on('end', () => {
            // Clean up temp image
            require('fs').unlink(tempImagePath, () => {});
            resolve(outputPath);
          })
          .on('error', (err) => {
            require('fs').unlink(tempImagePath, () => {});
            reject(err);
          })
          .run();
      });
    });
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
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilter([
          `fade=t=in:st=0:d=${fadeInDuration}`,
          `fade=t=out:st=${fadeOutDuration}:d=${fadeOutDuration}`
        ])
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  async adjustVolume(inputPath, outputPath, volume = 1.0) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFilter(`volume=${volume}`)
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
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
    
    return new Promise((resolve, reject) => {
      const loopCount = Math.ceil(minimumDuration / currentDuration);
      const exactDuration = minimumDuration;
      
      // Create a file list for seamless looping
      const fs = require('fs');
      const path = require('path');
      const fileListPath = outputPath.replace('.mp4', '_loop.txt');
      
      // Generate loop entries
      let fileList = '';
      for (let i = 0; i < loopCount; i++) {
        fileList += `file '${path.resolve(inputPath)}'\n`;
      }
      
      fs.writeFileSync(fileListPath, fileList);
      
      ffmpeg()
        .input(fileListPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(`-t ${exactDuration}`) // Cut to exact duration
        .outputOptions('-c:v libx264')
        .outputOptions('-c:a aac')
        .outputOptions('-b:a 256k') // Higher quality audio for looped content
        .outputOptions('-ar 44100')
        .outputOptions('-ac 2')
        .output(outputPath)
        .on('end', () => {
          fs.unlink(fileListPath, () => {}); // Clean up
          resolve(outputPath);
        })
        .on('error', (err) => {
          fs.unlink(fileListPath, () => {}); // Clean up
          reject(err);
        })
        .run();
    });
  }

  validateCodecs() {
    return new Promise((resolve) => {
      ffmpeg.getAvailableCodecs((err, codecs) => {
        if (err) {
          console.error('Error getting available codecs:', err);
          resolve(false);
          return;
        }
        
        const requiredCodecs = ['libx264', 'aac'];
        const availableCodecs = Object.keys(codecs);
        const hasRequired = requiredCodecs.every(codec => availableCodecs.includes(codec));
        
        if (hasRequired) {
          console.log('✅ Required codecs available');
        } else {
          console.warn('⚠️ Some required codecs may not be available');
        }
        
        resolve(hasRequired);
      });
    });
  }
}

module.exports = new FFmpegUtil();