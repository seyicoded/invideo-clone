const scriptService = require("./scriptService");

class SceneService {
  constructor() {
    this.defaultSceneDuration = 8; // seconds per scene for longer content
    this.maxScenes = 25; // Much higher limit for longer videos
    this.targetWordsPerScene = 50; // Target words per scene for better pacing
  }

  async breakdownIntoScenes(script) {
    try {
      console.log('🎬 Breaking down script into scenes');
      
      // Split script into sentences
      const sentences = this.splitIntoSentences(script);
      
      // Group sentences into scenes
      const scenes = this.groupIntoScenes(sentences);
      
      // Extract keywords for each scene
      let scenesWithKeywords = scenes.map((scene, index) => ({
        id: index + 1,
        text: scene.text,
        // keywords: (await extractKeywords(scene.text)),
        duration: scene.duration || this.defaultSceneDuration,
        order: index + 1
      }));

      scenesWithKeywords = await Promise.all(scenesWithKeywords.map(async (scene) => {
        const keywords = await this.extractKeywords(scene.text);
        return {
          ...scene,
          keywords
        };
      }));

      console.log(`✅ Created ${scenesWithKeywords.length} scenes`);
      return scenesWithKeywords;
    } catch (error) {
      console.error('Error breaking down script:', error);
      throw error;
    }
  }

  splitIntoSentences(script) {
    // Split by sentence endings, but keep the punctuation
    return script
      .split(/(?<=[.!?])\s+/)
      .filter(sentence => sentence.trim().length > 0)
      .map(sentence => sentence.trim());
  }

  groupIntoScenes(sentences) {
    const scenes = [];
    
    let currentScene = { text: '', wordCount: 0 };
    
    for (const sentence of sentences) {
      const wordCount = sentence.split(' ').length;
      
      // If adding this sentence would make the scene too long, start a new scene
      if (currentScene.wordCount > 0 && 
          (currentScene.wordCount + wordCount) > this.targetWordsPerScene && 
          scenes.length < this.maxScenes - 1) {
        
        scenes.push({
          text: currentScene.text.trim(),
          duration: this.calculateDuration(currentScene.text)
        });
        
        currentScene = { text: sentence, wordCount: wordCount };
      } else {
        currentScene.text += (currentScene.text ? ' ' : '') + sentence;
        currentScene.wordCount += wordCount;
      }
    }
    
    // Add the last scene
    if (currentScene.text) {
      scenes.push({
        text: currentScene.text.trim(),
        duration: this.calculateDuration(currentScene.text)
      });
    }
    
    return scenes;
  }

  calculateDuration(text) {
    // Estimate speaking time: average 150 words per minute for natural pacing
    const wordCount = text.split(' ').length;
    const estimatedSeconds = Math.max(4, Math.ceil((wordCount / 150) * 60));
    
    // Allow longer scenes for more detailed content, cap at 15 seconds
    return Math.min(estimatedSeconds, 15);
  }

  async extractKeywordsWithAI(text){

    let response = null;
    const prompt = `
    You are a keyword extraction system for stock video search.

Given a scene description, extract the best 2-word keyword phrase for finding background videos on Pexels.

Rules:
- Output ONLY 2 words
- Must describe a visual background (not abstract ideas or names)
- Must be suitable for stock video search (e.g. "tech startup", "city skyline", "AI technology")
- No punctuation, no explanations, no extra text
- Prefer general, visual, and searchable phrases

Scene:
${text}
    `;
    if (scriptService.llmServer === 'openai') {
        response = await scriptService.generateScriptWithOpenAI(prompt);
      } else if (scriptService.llmServer === 'ollama') {
        response = await scriptService.generateScriptWithOllama(prompt);
      } else {
        throw new Error(`Unsupported LLM server: ${scriptService.llmServer}`);
      }

      const keywords = response.split(',').map(k => k.trim());
    return keywords;

    // const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    //   model: 'gpt-4o-mini',
    //   messages: [
    //     {
    //       role: 'system',
    //       content: `
    //         You are a keyword extraction system for stock video search.

    //         Given a scene description, extract the best 2-word keyword phrase for finding background videos on Pexels.

    //         Rules:
    //         - Output ONLY 2 words
    //         - Must describe a visual background (not abstract ideas or names)
    //         - Must be suitable for stock video search (e.g. "tech startup", "city skyline", "AI technology")
    //         - No punctuation, no explanations, no extra text
    //         - Prefer general, visual, and searchable phrases
    //       `
    //     },
    //     {
    //       role: 'user',
    //       content: `Extract keywords from the following text: "${text}"`
    //     }
    //   ]
    // });

    // const keywords = response.data.choices[0].message.content.split(',').map(k => k.trim());
    // return keywords;
  }

  async extractKeywords(text) {

    // use ai else fallback to simple extraction
    try {
      const aiKeywords = await this.extractKeywordsWithAI(text);
      if (aiKeywords && aiKeywords.length > 0) {
        return aiKeywords;
      }
    } catch (error) {
      console.error('AI keyword extraction failed:', error);
    }


    // Simple keyword extraction
    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'and', 'a', 'to', 'are', 'as', 'was',
      'will', 'be', 'have', 'has', 'had', 'by', 'for', 'of', 'with', 'in',
      'that', 'this', 'it', 'from', 'they', 'we', 'you', 'your', 'our', 'an'
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));

    // Get unique words and limit to most relevant ones
    const uniqueWords = [...new Set(words)];
    
    // For video search, prioritize nouns and adjectives
    const keywords = uniqueWords.slice(0, 3);
    
    // Add some contextual keywords based on common themes
    const enhancedKeywords = this.enhanceKeywords(keywords, text);
    
    return enhancedKeywords.slice(0, 4); // Limit to 4 keywords per scene
  }

  enhanceKeywords(keywords, text) {
    const textLower = text.toLowerCase();
    const contextualKeywords = [];
    
    // Travel context
    if (textLower.match(/travel|trip|vacation|visit|explore|destination|journey/)) {
      contextualKeywords.push('travel', 'tourism', 'landscape');
    }
    
    // Food context
    if (textLower.match(/food|eat|taste|cuisine|restaurant|cooking|delicious/)) {
      contextualKeywords.push('food', 'cooking', 'restaurant');
    }
    
    // Nature context
    if (textLower.match(/nature|beach|mountain|forest|ocean|lake|sunset|sunrise/)) {
      contextualKeywords.push('nature', 'landscape', 'scenic');
    }
    
    // Culture context
    if (textLower.match(/culture|history|ancient|museum|art|traditional/)) {
      contextualKeywords.push('culture', 'heritage', 'traditional');
    }
    
    // People context
    if (textLower.match(/people|friends|family|group|crowd|celebration/)) {
      contextualKeywords.push('people', 'lifestyle', 'social');
    }

    // Combine original keywords with contextual ones
    const allKeywords = [...keywords, ...contextualKeywords];
    
    // Remove duplicates and return
    return [...new Set(allKeywords)];
  }

  validateScenes(scenes) {
    const errors = [];
    
    if (!Array.isArray(scenes) || scenes.length === 0) {
      errors.push('Scenes must be a non-empty array');
    }
    
    scenes.forEach((scene, index) => {
      if (!scene.text || typeof scene.text !== 'string') {
        errors.push(`Scene ${index + 1}: Missing or invalid text`);
      }
      
      if (!Array.isArray(scene.keywords) || scene.keywords.length === 0) {
        errors.push(`Scene ${index + 1}: Missing or invalid keywords`);
      }
      
      if (!scene.duration || typeof scene.duration !== 'number' || scene.duration <= 0) {
        errors.push(`Scene ${index + 1}: Missing or invalid duration`);
      }
    });
    
    return errors;
  }
}

module.exports = new SceneService();