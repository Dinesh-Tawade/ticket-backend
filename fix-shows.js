const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Show = require('./models/Show');

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected...');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

const fixShows = async () => {
  await connectDB();
  
  const shows = await Show.find({});
  let count = 0;
  let deletedCount = 0;
  
  const now = new Date();
  
  for (const show of shows) {
    let latestExpireTime = new Date(0);

    if (show.timings && show.timings.length > 0) {
      show.timings.forEach(t => {
        let d = new Date(t.showDate);
        if (t.endTime) {
          const [hours, minutes] = t.endTime.split(':');
          d.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        } else {
           d.setHours(23, 59, 59, 999);
        }
        if (d > latestExpireTime) latestExpireTime = d;
      });
    } else if (show.showDate) {
      latestExpireTime = new Date(show.showDate);
      if (show.endTime) {
        const [hours, minutes] = show.endTime.split(':');
        latestExpireTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      } else {
         latestExpireTime.setHours(23, 59, 59, 999);
      }
    }
    
    if (latestExpireTime < now) {
      // It has already expired, let's just delete it immediately
      await Show.findByIdAndDelete(show._id);
      deletedCount++;
    } else {
      if (latestExpireTime.getTime() > 0) {
        show.expireAt = latestExpireTime;
        await show.save();
        count++;
      }
    }
  }
  
  console.log(`Updated ${count} shows with expireAt`);
  console.log(`Deleted ${deletedCount} already expired shows`);
  process.exit();
};

fixShows();
