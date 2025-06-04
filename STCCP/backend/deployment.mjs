// deployment.mjs - Script to prepare files for Azure deployment
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create dist directory if it doesn't exist
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
} else {
  // Clean dist directory
  console.log('Cleaning dist directory...');
  if (process.platform === 'win32') {
    try {
      execSync('powershell -Command "if (Test-Path dist\\*) { Remove-Item -Path dist\\* -Force -Recurse }"', { stdio: 'inherit' });
    } catch (error) {
      console.log('No files to clean in dist folder');
    }
  } else {
    try {
      execSync('rm -rf dist/*', { stdio: 'inherit' });
    } catch (error) {
      console.log('No files to clean in dist folder');
    }
  }
}

// Compile TypeScript to JavaScript
console.log('Compiling TypeScript to JavaScript...');
try {
  execSync('npx tsc', { stdio: 'inherit' });
  console.log('TypeScript compilation successful.');
} catch (error) {
  console.error('Error compiling TypeScript:', error);
  process.exit(1);
}

// Copy web.config to dist
console.log('Copying web.config to dist folder...');
fs.copyFileSync(
  path.join(__dirname, 'web.config'),
  path.join(distDir, 'web.config')
);

// Copy uploads directory
console.log('Setting up uploads directory...');
const srcUploadsDir = path.join(__dirname, 'uploads');
const distUploadsDir = path.join(distDir, 'uploads');
if (!fs.existsSync(distUploadsDir)) {
  fs.mkdirSync(distUploadsDir);
}

// Copy files from uploads if they exist
if (fs.existsSync(srcUploadsDir)) {
  const files = fs.readdirSync(srcUploadsDir);
  for (const file of files) {
    const srcFile = path.join(srcUploadsDir, file);
    const distFile = path.join(distUploadsDir, file);
    fs.copyFileSync(srcFile, distFile);
  }
  console.log(`Copied ${files.length} files from uploads directory`);
}

// Copy .env file if exists
const envFile = path.join(__dirname, '.env');
const distEnvFile = path.join(distDir, '.env');
if (fs.existsSync(envFile)) {
  console.log('Copying .env file...');
  fs.copyFileSync(envFile, distEnvFile);
}

// Create package.json for deployment
console.log('Creating package.json for deployment...');
const packageJson = require('./package.json');
const deployPackageJson = {
  name: packageJson.name || "stccp-backend",
  version: packageJson.version || "1.0.0",  main: "server.js",
  type: "module", // Must be module to match the original package.json
  scripts: {
    "start": "node server.js"
  },
  dependencies: packageJson.dependencies,
  engines: {
    "node": ">=18.0.0"
  }
};
fs.writeFileSync(path.join(distDir, 'package.json'), JSON.stringify(deployPackageJson, null, 2));

// Create the zip file for deployment
console.log('Creating deployment zip file...');
const zipCommand = process.platform === 'win32'
  ? 'powershell -Command "Compress-Archive -Path \\"dist\\*\\" -DestinationPath \\"dist.zip\\" -Force"'
  : 'cd dist && zip -r ../dist.zip .';

try {
  execSync(zipCommand, { stdio: 'inherit' });
  console.log('Zip file created successfully at ./dist.zip');
} catch (error) {
  console.error('Error creating zip file:', error);
  process.exit(1);
}

console.log('Deployment preparation complete.');
