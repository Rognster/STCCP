// deployment.js - Script to prepare files for Azure deployment
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
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
      execSync('if exist dist\\* del /Q dist\\*', { shell: 'cmd.exe', stdio: 'inherit' });
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

// Copy server.js from dist to the root of the deployment package for Azure App Service
console.log('Preparing server entry point for Azure...');
try {
  // First make sure dist/server.js exists after TypeScript compilation
  if (fs.existsSync(path.join(distDir, 'server.js'))) {
    // Copy server.js to the root level of the dist folder
    // This ensures it will be at C:\home\site\wwwroot\server.js on Azure
    // This is required because our web.config is configured to use server.js at the root
    fs.copyFileSync(
      path.join(distDir, 'server.js'),
      path.join(distDir, 'server.js')  // Same location, no change needed
    );
    console.log('Server.js is ready at the root level for Azure App Service compatibility');
  } else {
    console.error('Error: server.js not found in dist folder after TypeScript compilation');
  }
} catch (error) {
  console.error('Error preparing server entry point:', error);
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
// Since we can't use require in ES modules, we'll read the file directly
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const deployPackageJson = {
  name: packageJson.name || "stccp-backend",
  version: packageJson.version || "1.0.0",
  main: "server.js",
  type: "module", // Add type: module to ensure ESM support
  scripts: {
    "start": "node server.js"  // This matches where we copy the file to in Azure
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
  ? 'powershell Compress-Archive -Path ".\\dist\\*" -DestinationPath ".\\dist.zip" -Force'
  : 'cd dist && zip -r ../dist.zip .';

try {
  execSync(zipCommand, { stdio: 'inherit' });
  console.log('Zip file created successfully at ./dist.zip');
} catch (error) {
  console.error('Error creating zip file:', error);
  process.exit(1);
}

console.log('Deployment preparation complete.');
