const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📀 Database Name: ${conn.connection.name}`);
    
    // Inspect and drop problematic unique indexes created previously
    try {
      const collections = await conn.connection.db.listCollections().toArray();
      const hasTheaters = collections.some(col => col.name === 'theaters');
      
      if (hasTheaters) {
        const collection = conn.connection.db.collection('theaters');
        const indexes = await collection.indexes();
        console.log('📋 Current indexes on theaters collection:', indexes.map(idx => idx.name).join(', '));
        
        const targetIndexName1 = 'screens.zones.id_1';
        const targetIndexName2 = 'screens.zones.rows.rowId_1';
        
        if (indexes.some(idx => idx.name === targetIndexName1)) {
          console.log(`Index ${targetIndexName1} found. Attempting to drop...`);
          await collection.dropIndex(targetIndexName1);
          console.log(`✅ Successfully dropped unique index: ${targetIndexName1}`);
        } else {
          console.log(`Index ${targetIndexName1} is already gone.`);
        }
        
        if (indexes.some(idx => idx.name === targetIndexName2)) {
          console.log(`Index ${targetIndexName2} found. Attempting to drop...`);
          await collection.dropIndex(targetIndexName2);
          console.log(`✅ Successfully dropped unique index: ${targetIndexName2}`);
        } else {
          console.log(`Index ${targetIndexName2} is already gone.`);
        }
      } else {
        console.log('ℹ️ No theaters collection exists in the database yet.');
      }
    } catch (e) {
      console.log('⚠️ Failed during index inspection/dropping:', e.message);
    }
    
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;