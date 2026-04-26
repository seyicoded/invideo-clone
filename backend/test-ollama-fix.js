#!/usr/bin/env node

// Quick test with fixed Ollama parameters
require('dotenv').config();
const axios = require('axios');

async function testOllamaFixed() {
  console.log('🧪 Testing Ollama with Fixed Parameters\n');
  
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const ollamaModel = process.env.OLLAMA_MODEL || 'dolphin-mistral:7b';
  
  console.log(`📋 Configuration:`);
  console.log(`   URL: ${ollamaUrl}`);
  console.log(`   Model: ${ollamaModel}\n`);

  try {
    console.log('🔗 Sending request to Ollama API...');
    
    const response = await axios.post(`${ollamaUrl}/api/generate`, {
      model: ollamaModel,
      prompt: "Write a short video script about The Future of AI. Make it engaging and informative.",
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: 500  // Fixed: using num_predict instead of max_tokens
      }
    });

    if (response.data && response.data.response) {
      console.log(`✅ Script generated successfully!`);
      console.log(`📊 Script length: ${response.data.response.length} characters`);
      console.log(`📖 Generated script:\n${response.data.response}\n`);
    } else {
      console.log('❌ Invalid response from Ollama API');
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  console.log('🎯 Test completed!');
}

testOllamaFixed().catch(console.error);
