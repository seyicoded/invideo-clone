const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class MediaService {
  constructor() {
    this.pexelsApiKey = process.env.PEXELS_API_KEY;
    this.pexelsBaseUrl = 'https://api.pexels.com/videos';
    this.tmpDir = path.join(__dirname, '..', 'tmp', 'videos');
  }

  async fetchMediaForScenes(scenes) {
    try {
      console.log('🎥 Fetching media for scenes');
      
      const mediaPromises = scenes.map((scene, index) => 
        this.fetchMediaForScene(scene, index)
      );
      
      const mediaResults = await Promise.allSettled(mediaPromises);
      
      // Process results and handle failures
      const processedScenes = scenes.map((scene, index) => {
        const result = mediaResults[index];
        
        if (result.status === 'fulfilled' && result.value) {
          return {
            ...scene,
            mediaUrl: result.value.url,
            mediaPath: result.value.path,
            mediaType: result.value.type
          };
        } else {
          console.warn(`Failed to fetch media for scene ${index + 1}, using fallback`);
          return {
            ...scene,
            mediaUrl: null,
            mediaPath: this.getFallbackMedia(scene),
            mediaType: 'image'
          };
        }
      });

      console.log('✅ Media fetching completed');
      return processedScenes;
    } catch (error) {
      console.error('Error fetching media:', error);
      throw error;
    }
  }

  async fetchMediaForScene(scene, sceneIndex) {
    try {
      if (!this.pexelsApiKey) {
        console.warn('Pexels API key not provided, using fallback media');
        return null;
      }

      const query = this.buildSearchQuery(scene.keywords);
      console.log(`🔍 Searching for: "${query}" (Scene ${sceneIndex + 1})`);
      
      const response = await axios.get(`${this.pexelsBaseUrl}/search`, {
        headers: {
          'Authorization': this.pexelsApiKey
        },
        params: {
          query: query,
          per_page: 10,
          orientation: 'landscape'
        }
      });

      if (response.data.videos && response.data.videos.length > 0) {
        const video = this.selectBestVideo(response.data.videos, scene.duration);
        const downloadedMedia = await this.downloadMedia(video, sceneIndex);
        return downloadedMedia;
      } else {
        console.log(`No videos found for query: ${query}`);
        return null;
      }
    } catch (error) {
      console.error(`Error fetching media for scene ${sceneIndex + 1}:`, error.message);
      return null;
    }
  }

  buildSearchQuery(keywords) {
    // Combine keywords intelligently
    if (!keywords || keywords.length === 0) {
      return 'nature landscape';
    }
    
    // Prioritize the most descriptive keywords
    const priorityKeywords = keywords.slice(0, 2);
    return priorityKeywords.join(' ');
  }

  selectBestVideo(videos, targetDuration) {
    // Filter videos by quality and duration
    const suitableVideos = videos.filter(video => {
      const hasGoodQuality = video.video_files.some(file => 
        file.quality === 'hd' || file.quality === 'sd'
      );
      return hasGoodQuality && video.duration >= targetDuration;
    });

    // If no suitable videos, use any available
    const videoPool = suitableVideos.length > 0 ? suitableVideos : videos;
    
    // Select a random video to add variety
    const selectedVideo = videoPool[Math.floor(Math.random() * videoPool.length)];
    
    // Find the best quality file
    const videoFile = this.selectBestVideoFile(selectedVideo.video_files);
    
    return {
      id: selectedVideo.id,
      url: videoFile.link,
      duration: selectedVideo.duration,
      quality: videoFile.quality,
      width: videoFile.width,
      height: videoFile.height
    };
  }

  selectBestVideoFile(videoFiles) {
    // Prioritize HD, then SD, then any available
    const priorities = ['hd', 'sd', 'hls'];
    
    for (const quality of priorities) {
      const file = videoFiles.find(f => f.quality === quality);
      if (file) return file;
    }
    
    // Fallback to first available
    return videoFiles[0];
  }

  async downloadMedia(video, sceneIndex) {
    try {
      const filename = `scene_${sceneIndex + 1}_${uuidv4()}.mp4`;
      const filepath = path.join(this.tmpDir, filename);
      
      console.log(`⬇️ Downloading video for scene ${sceneIndex + 1}`);
      
      // Download the video file
      const response = await axios({
        method: 'GET',
        url: video.url,
        responseType: 'stream',
        timeout: 30000 // 30 second timeout
      });

      const writer = fs.createWriteStream(filepath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          console.log(`✅ Downloaded: ${filename}`);
          resolve({
            path: filepath,
            url: video.url,
            type: 'video',
            duration: video.duration,
            filename: filename
          });
        });

        writer.on('error', (error) => {
          console.error(`Error downloading video: ${error.message}`);
          reject(error);
        });
      });
    } catch (error) {
      console.error('Download failed:', error.message);
      throw error;
    }
  }

  getFallbackMedia(scene) {
    // Create a simple colored background as fallback
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'
    ];
    
    const color = colors[scene.id % colors.length];
    
    // For now, return null - the video service will handle creating a color background
    console.log(`Using color background: ${color} for scene ${scene.id}`);
    return null;
  }

  async cleanupTempFiles() {
    try {
      const files = await fs.readdir(this.tmpDir);
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      for (const file of files) {
        const filepath = path.join(this.tmpDir, file);
        const stats = await fs.stat(filepath);
        
        if (stats.mtime.getTime() < oneHourAgo) {
          await fs.remove(filepath);
          console.log(`🗑️ Cleaned up old file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up temp files:', error);
    }
  }

  validateApiKey() {
    if (!this.pexelsApiKey) {
      console.warn('⚠️ Pexels API key not configured. Video fetching will use fallback.');
      return false;
    }
    return true;
  }
}

module.exports = new MediaService();