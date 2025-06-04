const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Creating deployment zip file...');

// Determine the appropriate zip command based on the platform
const zipCommand = process.platform === 'win32' 
  ? 'powershell Compress-Archive -Path ".\\dist\\*" -DestinationPath ".\\dist.zip" -Force'
  : 'cd dist && zip -r ../dist.zip .';

try {
  execSync(zipCommand, { stdio: 'inherit' });
  console.log('Zip file created successfully at ./dist.zip');
} catch (error) {
  console.error('Error creating zip file:', error);
  process.exit(1);
}
