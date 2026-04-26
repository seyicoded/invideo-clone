# LLM Service Switching Guide

This guide explains how to switch between different Language Model (LLM) services for script generation in the InVideo Clone project.

## Supported LLM Services

- **Ollama**: Local LLM service (default)
- **OpenAI**: Cloud-based API service

## Configuration

### Environment Variables

Add these variables to your `backend/.env` file:

```env
# LLM Service Selection (ollama or openai)
LLM_SERVER=ollama

# Ollama Configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=dolphin-mistral:7b

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
```

### Switching Between Services

#### Option 1: Using Ollama (Local)

```env
LLM_SERVER=ollama
```

**Requirements:**

- Ollama installed and running locally
- Model downloaded (e.g., `ollama pull dolphin-mistral:7b`)

**Advantages:**

- Free to use
- Privacy-focused (local processing)
- No internet required for inference

#### Option 2: Using OpenAI (Cloud)

```env
LLM_SERVER=openai
```

**Requirements:**

- Valid OpenAI API key
- Internet connection
- OpenAI account with credits

**Advantages:**

- High-quality outputs
- Faster response times
- No local resource usage

## Installation

### For OpenAI Support

```bash
cd backend
npm install openai
```

### For Ollama Support

1. Install Ollama: https://ollama.ai/
2. Pull a model: `ollama pull dolphin-mistral:7b`
3. Start Ollama service: `ollama serve`

## Testing

Run the test script to verify your configuration:

```bash
cd backend
node test-llm-switch.js
```

This will:

- Display current configuration
- Test LLM service connection
- Generate a sample script
- Show performance metrics

## API Usage

The ScriptService automatically detects the configured LLM service:

```javascript
const scriptService = require("./services/scriptService");

// Generate script (automatically uses configured LLM)
const script = await scriptService.generateScript("Your Topic");

// Test connection
const isAvailable = await scriptService.testLLMConnection();
```

## Error Handling

If the primary LLM service fails, the system will:

1. Log the error
2. Fall back to a pre-generated script template
3. Continue processing without interruption

## Performance Comparison

| Feature | Ollama (Local)      | OpenAI (Cloud)     |
| ------- | ------------------- | ------------------ |
| Cost    | Free                | Pay per use        |
| Speed   | Depends on hardware | Fast               |
| Privacy | Complete            | Shared with OpenAI |
| Quality | Good                | Excellent          |
| Offline | ✅ Yes              | ❌ No              |

## Troubleshooting

### Common Issues

1. **Ollama Connection Failed**
   - Check if Ollama is running: `ollama serve`
   - Verify model is installed: `ollama list`
   - Check OLLAMA_URL in .env

2. **OpenAI API Errors**
   - Verify API key is correct
   - Check account has credits
   - Ensure model name is valid

3. **Script Generation Fails**
   - System will use fallback scripts
   - Check logs for specific error messages
   - Verify network connectivity

### Debug Mode

Set LOG_LEVEL=debug in .env for detailed logging:

```env
LOG_LEVEL=debug
```

## Custom Models

### Ollama

Use any compatible model:

```env
OLLAMA_MODEL=llama2
OLLAMA_MODEL=codellama
OLLAMA_MODEL=mistral
```

### OpenAI

Use any available model:

```env
OPENAI_MODEL=gpt-4
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_MODEL=gpt-4o-mini
```
