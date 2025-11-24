import mongoose from 'mongoose'

// Define the structure for the global mongoose cache
interface MongooseCache {
  conn: mongoose.Connection | null
  promise: Promise<mongoose.Connection> | null
}

// Extend the global object to include our mongoose cache
declare global {
  // This prevents TypeScript from complaining about the global variable
  var mongoose: MongooseCache | undefined
}

// MongoDB connection URI - should be set in environment variables
const MONGODB_URI: string = process.env.MONGODB_URI!

// Validate that MongoDB URI is provided
if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env'
  )
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached: MongooseCache = global.mongoose || { conn: null, promise: null }

if (!global.mongoose) {
  global.mongoose = cached
}

/**
 * Establishes and caches a connection to MongoDB using Mongoose
 * 
 * @returns Promise<mongoose.Connection> - The MongoDB connection instance
 * 
 * @example
 * import { connectToDatabase } from '@/lib/mongodb'
 * 
 * export async function GET() {
 *   await connectToDatabase()
 *   // Your database operations here
 * }
 */
async function connectToDatabase(): Promise<mongoose.Connection> {
  // If we already have a cached connection, return it
  if (cached.conn) {
    return cached.conn
  }

  // If we don't have a connection, but we have a promise, wait for it
  if (!cached.promise) {
    const options: mongoose.ConnectOptions = {
      bufferCommands: false, // Disable mongoose buffering
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
    }

    // Create the connection promise
    cached.promise = mongoose.connect(MONGODB_URI, options).then((mongoose) => {
      console.log('✅ Connected to MongoDB successfully')
      return mongoose.connection
    }).catch((error) => {
      console.error('❌ MongoDB connection error:', error)
      throw error
    })
  }

  try {
    // Wait for the connection promise to resolve
    cached.conn = await cached.promise
    return cached.conn
  } catch (error) {
    // Reset the promise if connection fails
    cached.promise = null
    throw error
  }
}

/**
 * Disconnects from MongoDB
 * Useful for cleanup in serverless environments or testing
 * 
 * @returns Promise<void>
 */
async function disconnectFromDatabase(): Promise<void> {
  if (cached.conn) {
    await mongoose.disconnect()
    cached.conn = null
    cached.promise = null
    console.log('🔌 Disconnected from MongoDB')
  }
}

/**
 * Gets the current connection status
 * 
 * @returns number - Mongoose connection ready state
 * 0 = disconnected
 * 1 = connected
 * 2 = connecting
 * 3 = disconnecting
 */
function getConnectionStatus(): number {
  return mongoose.connection.readyState
}

/**
 * Checks if the database is currently connected
 * 
 * @returns boolean - True if connected, false otherwise
 */
function isConnected(): boolean {
  return mongoose.connection.readyState === 1
}

// Export the main functions
export {
  connectToDatabase,
  disconnectFromDatabase,
  getConnectionStatus,
  isConnected
}

// Default export for convenience
export default connectToDatabase