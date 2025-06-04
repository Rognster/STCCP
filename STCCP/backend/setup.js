// Setup for Azure Cosmos DB
// Run this script to set up your Cosmos DB connection

import inquirer from 'inquirer';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_FILE = path.join(__dirname, '.env');

// Check if .env file exists
let envConfig = {};
if (fs.existsSync(ENV_FILE)) {
  dotenv.config({ path: ENV_FILE });
  envConfig = process.env;
}

async function main() {
  console.log('Azure Cosmos DB Setup for Simon Says Game');
  console.log('=========================================');
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'endpoint',
      message: 'Enter your Azure Cosmos DB endpoint URL:',
      default: envConfig.COSMOSDB_ENDPOINT || '',
      validate: input => input.includes('documents.azure.com') || input.includes('cosmos.azure.com') ? true : 'Please enter a valid Cosmos DB endpoint'
    },
    {
      type: 'input',
      name: 'key',
      message: 'Enter your Azure Cosmos DB primary key:',
      default: envConfig.COSMOSDB_KEY || '',
      validate: input => input.length > 10 ? true : 'Please enter a valid Cosmos DB key'
    },
    {
      type: 'input',
      name: 'database',
      message: 'Enter the database name:',
      default: envConfig.COSMOSDB_DATABASE_NAME || 'gamescores',
    },
    {
      type: 'input',
      name: 'container',
      message: 'Enter the container name:',
      default: envConfig.COSMOSDB_CONTAINER_NAME || 'results',
    }
  ]);

  // Create or update .env file
  const envContent = `# Azure Cosmos DB Connection
COSMOSDB_ENDPOINT=${answers.endpoint}
COSMOSDB_KEY=${answers.key}
COSMOSDB_DATABASE_NAME=${answers.database}
COSMOSDB_CONTAINER_NAME=${answers.container}`;

  fs.writeFileSync(ENV_FILE, envContent);
  
  console.log('\nConfiguration saved to .env file!');
  console.log('You can now start the server with: npm run dev');
}

main().catch(error => {
  console.error('Error during setup:', error);
  process.exit(1);
});
