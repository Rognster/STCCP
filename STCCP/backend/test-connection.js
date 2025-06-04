// Test Cosmos DB Connection
import { CosmosClient } from '@azure/cosmos';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Configure Cosmos DB
const cosmosEndpoint = process.env.COSMOSDB_ENDPOINT || '';
const cosmosKey = process.env.COSMOSDB_KEY || '';
const databaseName = process.env.COSMOSDB_DATABASE_NAME || 'gamescores';
const containerName = process.env.COSMOSDB_CONTAINER_NAME || 'results';

console.log('Testing connection to Azure Cosmos DB...');
console.log(`Database: ${databaseName}`);
console.log(`Container: ${containerName}`);

// Initialize Cosmos client
const cosmosClient = new CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey });

async function testConnection() {
  try {
    // Try to fetch database info
    const { database } = await cosmosClient.databases.createIfNotExists({
      id: databaseName
    });
    console.log(`✓ Successfully connected to database '${database.id}'`);
    
    // Try to fetch container info
    const { container } = await database.containers.createIfNotExists({
      id: containerName,
      partitionKey: { paths: ["/email"] }
    });
    console.log(`✓ Successfully connected to container '${container.id}'`);
    
    // Try to query items (just check if the query works, limit to 1 item)
    const { resources } = await container.items
      .query("SELECT TOP 1 * FROM c")
      .fetchAll();
    
    console.log(`✓ Successfully queried container (found ${resources.length} items)`);
    console.log('\n✅ Connection test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing Cosmos DB connection:', error.message);
    console.error(error);
  }
}

testConnection();
