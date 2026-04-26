#!/usr/bin/env node

// Demo script to show LLM switching functionality
require('dotenv').config();

console.log('🔄 LLM Switching Demo\n');

// Demo 1: Show current configuration detection
console.log('📋 Current Configuration:');
console.log(`   LLM_SERVER: ${process.env.LLM_SERVER || 'ollama (default)'}`);
console.log(`   OLLAMA_MODEL: ${process.env.OLLAMA_MODEL || 'mistral (default)'}`);
console.log(`   OPENAI_MODEL: ${process.env.OPENAI_MODEL || 'gpt-4o-mini (default)'}`);
console.log(`   OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Not set'}\n`);

// Demo 2: Show ScriptService initialization
const ScriptService = require('./services/scriptService');
console.log('✅ ScriptService loaded with dynamic LLM selection\n');

// Demo 3: Show how to test connections
async function demoConnections() {
  console.log('🔗 Testing LLM Connections:');
  
  try {
    const connected = await ScriptService.testLLMConnection();
    console.log(`   Current LLM (${process.env.LLM_SERVER || 'ollama'}): ${connected ? '✅ Available' : '❌ Not available'}`);
  } catch (error) {
    console.log(`   Connection test failed: ${error.message}`);
  }
  
  console.log('');
}

// Demo 4: Show fallback mechanism
function demoFallback() {
  console.log('🛡️ Fallback Script Generation:');
  try {
    const fallbackScript = ScriptService.generateFallbackScript('Test Topic');
    console.log(`   ✅ Fallback works: Generated ${fallbackScript.length} characters`);
    console.log(`   📝 Preview: "${fallbackScript.substring(0, 100)}..."\n`);
  } catch (error) {
    console.log(`   ❌ Fallback failed: ${error.message}\n`);
  }
}

// Demo 5: Instructions for switching
function showInstructions() {
  console.log('⚙️ How to Switch LLM Services:\n');
  
  console.log('For Ollama (Local):');
  console.log('   1. Set LLM_SERVER=ollama in .env');
  console.log('   2. Install Ollama: https://ollama.ai/');
  console.log('   3. Pull model: ollama pull dolphin-mistral:7b');
  console.log('   4. Start service: ollama serve\n');
  
  console.log('For OpenAI (Cloud):');
  console.log('   1. Set LLM_SERVER=openai in .env');
  console.log('   2. Add OPENAI_API_KEY=your_key_here');
  console.log('   3. Optional: Set OPENAI_MODEL=gpt-4o-mini\n');
  
  console.log('The system will automatically:');
  console.log('   ✅ Detect the configured LLM service');
  console.log('   ✅ Route requests to the correct API');
  console.log('   ✅ Use fallback scripts if LLM fails');
  console.log('   ✅ Provide detailed error logging\n');
}

// Run the demo
async function runDemo() {
  await demoConnections();
  demoFallback();
  showInstructions();
  
  console.log('🎯 LLM switching mechanism is ready!');
  console.log('💡 Change LLM_SERVER in .env to switch between services.');
}

runDemo().catch(console.error);