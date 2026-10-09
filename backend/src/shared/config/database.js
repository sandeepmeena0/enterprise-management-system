const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;

  if (!process.env.MONGO_URI) {
    console.warn('\n⚠️  MONGO_URI is not defined in environment variables. Database features will be in standby.\n');
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);

    isConnected = true;

    console.log(`\n🍃 MongoDB Atlas Cloud Connected successfully!`);
    console.log(`   Database: ${conn.connection.name}\n`);

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('\n⚠️  MongoDB connection closed due to app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error('\n❌ MongoDB Connection Error:', error.message);
    console.error('💡 Tip: Ensure your IP is whitelisted (0.0.0.0/0) in MongoDB Atlas Network Access.\n');
  }
};

module.exports = connectDB;
