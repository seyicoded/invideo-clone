#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');

const BACKUP_SUFFIX = '_backup';
const REFACTORED_SUFFIX = '_refactored';

/**
 * Migration script to switch between old and refactored implementation
 * Usage:
 *   node migration.js use-refactored  # Switch to new refactored flow
 *   node migration.js use-original    # Switch back to original flow
 *   node migration.js status          # Show current status
 */

async function backupFile(filePath) {
  const backupPath = filePath + BACKUP_SUFFIX + path.extname(filePath);
  
  if (fs.existsSync(filePath) && !fs.existsSync(backupPath)) {
    await fs.copy(filePath, backupPath);
    console.log(`📦 Backed up: ${path.basename(filePath)} → ${path.basename(backupPath)}`);
  }
}

async function useRefactoredFlow() {
  console.log('🔄 Switching to REFACTORED flow...\n');
  
  try {
    // Backup original files
    await backupFile(path.join(__dirname, 'index.js'));
    await backupFile(path.join(__dirname, 'routes/videoRoutes.js'));
    await backupFile(path.join(__dirname, 'services/ttsService.js'));
    await backupFile(path.join(__dirname, 'services/videoService.js'));
    
    // Copy refactored files to active locations
    const filesToCopy = [
      {
        from: path.join(__dirname, 'index_refactored.js'),
        to: path.join(__dirname, 'index.js')
      },
      {
        from: path.join(__dirname, 'routes/videoRoutes_refactored.js'),
        to: path.join(__dirname, 'routes/videoRoutes.js')
      },
      {
        from: path.join(__dirname, 'services/ttsService_refactored.js'),
        to: path.join(__dirname, 'services/ttsService.js')
      },
      {
        from: path.join(__dirname, 'services/videoService_refactored.js'),
        to: path.join(__dirname, 'services/videoService.js')
      }
    ];
    
    for (const { from, to } of filesToCopy) {
      if (fs.existsSync(from)) {
        await fs.copy(from, to);
        console.log(`✅ Activated: ${path.basename(from)} → ${path.basename(to)}`);
      } else {
        console.warn(`⚠️ Missing: ${path.basename(from)}`);
      }
    }
    
    console.log('\n🎉 Successfully switched to REFACTORED flow!');
    console.log('🎯 New Flow: Script → Scenes → Media → Audio → Video');
    console.log('📋 Benefits:');
    console.log('   • Audio generated first with exact timing');
    console.log('   • Video built around perfect audio');
    console.log('   • Sequential processing prevents conflicts');
    console.log('   • No more audio breaking or video hanging');
    console.log('\n🚀 Restart the server to use the new flow:');
    console.log('   npm start  # or node index.js');
    
  } catch (error) {
    console.error('❌ Failed to switch to refactored flow:', error.message);
    process.exit(1);
  }
}

async function useOriginalFlow() {
  console.log('🔄 Switching back to ORIGINAL flow...\n');
  
  try {
    const filesToRestore = [
      {
        from: path.join(__dirname, 'index.js_backup.js'),
        to: path.join(__dirname, 'index.js')
      },
      {
        from: path.join(__dirname, 'routes/videoRoutes.js_backup.js'),
        to: path.join(__dirname, 'routes/videoRoutes.js')
      },
      {
        from: path.join(__dirname, 'services/ttsService.js_backup.js'),
        to: path.join(__dirname, 'services/ttsService.js')
      },
      {
        from: path.join(__dirname, 'services/videoService.js_backup.js'),
        to: path.join(__dirname, 'services/videoService.js')
      }
    ];
    
    for (const { from, to } of filesToRestore) {
      if (fs.existsSync(from)) {
        await fs.copy(from, to);
        console.log(`✅ Restored: ${path.basename(from)} → ${path.basename(to)}`);
      } else {
        console.warn(`⚠️ No backup found: ${path.basename(from)}`);
      }
    }
    
    console.log('\n🎉 Successfully switched back to ORIGINAL flow!');
    console.log('\n🚀 Restart the server to use the original flow:');
    console.log('   npm start  # or node index.js');
    
  } catch (error) {
    console.error('❌ Failed to switch to original flow:', error.message);
    process.exit(1);
  }
}

async function showStatus() {
  console.log('📊 Current Implementation Status:\n');
  
  const files = [
    { path: 'index.js', type: 'main' },
    { path: 'routes/videoRoutes.js', type: 'routes' },
    { path: 'services/ttsService.js', type: 'tts' },
    { path: 'services/videoService.js', type: 'video' }
  ];
  
  for (const file of files) {
    const filePath = path.join(__dirname, file.path);
    const backupPath = filePath + '_backup.js';
    const refactoredPath = filePath.replace('.js', '_refactored.js');
    
    console.log(`📁 ${file.path}:`);
    
    if (fs.existsSync(filePath)) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        if (content.includes('REFACTORED') || content.includes('refactored')) {
          console.log('   ✅ Currently using REFACTORED version');
        } else {
          console.log('   📝 Currently using ORIGINAL version');
        }
      } catch (error) {
        console.log('   ❓ Could not determine version');
      }
    } else {
      console.log('   ❌ File not found');
    }
    
    if (fs.existsSync(backupPath)) {
      console.log('   💾 Backup available');
    }
    
    if (fs.existsSync(refactoredPath)) {
      console.log('   🆕 Refactored version available');
    }
    
    console.log('');
  }
  
  console.log('Commands:');
  console.log('   node migration.js use-refactored  # Switch to new flow');
  console.log('   node migration.js use-original    # Switch to original flow');
}

async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'use-refactored':
      await useRefactoredFlow();
      break;
      
    case 'use-original':
      await useOriginalFlow();
      break;
      
    case 'status':
      await showStatus();
      break;
      
    default:
      console.log('InVideo AI Clone - Flow Migration Tool\n');
      console.log('Usage:');
      console.log('  node migration.js use-refactored  # Switch to new refactored flow');
      console.log('  node migration.js use-original    # Switch back to original flow');
      console.log('  node migration.js status          # Show current status');
      console.log('\nRefactored Flow Benefits:');
      console.log('  ✅ Audio generated FIRST with exact scene timing');
      console.log('  ✅ Video built AROUND the perfect audio track');
      console.log('  ✅ Sequential processing prevents conflicts');
      console.log('  ✅ No more audio breaking or video hanging');
      break;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  useRefactoredFlow,
  useOriginalFlow,
  showStatus
};