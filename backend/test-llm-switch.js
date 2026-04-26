#!/usr/bin/env node

// Test script for LLM switching functionality
require('dotenv').config();
const scriptService = require('./services/scriptService');

async function testLLMSwitching() {
  console.log('🧪 Testing LLM Switching Functionality\n');
  
  console.log(`📋 Current Configuration:`);
  console.log(`   LLM_SERVER: ${process.env.LLM_SERVER || 'ollama (default)'}`);
  console.log(`   OLLAMA_URL: ${process.env.OLLAMA_URL || 'http://localhost:11434 (default)'}`);
  console.log(`   OLLAMA_MODEL: ${process.env.OLLAMA_MODEL || 'mistral (default)'}`);
  console.log(`   OPENAI_MODEL: ${process.env.OPENAI_MODEL || 'gpt-4o-mini (default)'}`);
  console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set'}\n`);

  // Test LLM connection
  console.log('🔍 Testing LLM Connection...');
  const isConnected = await scriptService.testLLMConnection();
  
  if (!isConnected) {
    console.log('⚠️  LLM service not available, script generation will use fallback\n');
  } else {
    console.log(`✅ ${process.env.LLM_SERVER || 'ollama'} service is available\n`);
  }

  // Test script generation with a simple topic
  console.log('📝 Testing Script Generation...');
  const testTopic = 'The Future of AI';
  
  try {
    const script = await scriptService.generateScript(testTopic);
    console.log(`✅ Script generated successfully!`);
    console.log(`📊 Script length: ${script.length} characters`);
    console.log(`📖 First 200 characters: "${script.substring(0, 200)}..."\n`);
  } catch (error) {
    console.log(`❌ Script generation failed: ${error.message}\n`);
  }

  console.log('🎯 Test completed!');
  console.log('\n💡 To switch LLM services, update LLM_SERVER in your .env file:');
  console.log('   - Set LLM_SERVER=ollama (requires Ollama running locally)');
  console.log('   - Set LLM_SERVER=openai (requires OPENAI_API_KEY)');
}

// Run the test
if (require.main === module) {
  testLLMSwitching().catch(console.error);
}

module.exports = { testLLMSwitching };