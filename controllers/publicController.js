const Show = require('../models/Show');
const Theater = require('../models/Theater');

// @desc    Get all shows (Public)
// @route   GET /api/public/shows
const getAllShows = async (req, res) => {
  try {
    const { city, movieName, date, genre, isTrending, language } = req.query;
    let filter = { status: 'BOOKING_OPEN' };
    
    if (city) {
      const theaters = await Theater.find({ city });
      filter.theaterId = { $in: theaters.map(t => t._id) };
    }
    if (movieName) filter['movie.name'] = { $regex: movieName, $options: 'i' };
    if (date) filter.showDate = { $gte: new Date(date), $lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1)) };
    if (genre) filter['movie.genre'] = genre;
    if (isTrending === 'true') filter['movie.isTrending'] = true;
    if (language) filter['movie.language'] = language;

    const shows = await Show.find(filter)
      .populate('theaterId', 'name location city')
      .sort({ showDate: 1, startTime: 1 });

    res.json({ success: true, count: shows.length, data: shows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get trending shows
// @route   GET /api/public/shows/trending
const getTrendingShows = async (req, res) => {
  try {
    const shows = await Show.find({ 
      'movie.isTrending': true, 
      status: 'BOOKING_OPEN' 
    })
    .populate('theaterId', 'name location city')
    .limit(10);

    res.json({ success: true, count: shows.length, data: shows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get show by ID
// @route   GET /api/public/shows/:id
const getShowById = async (req, res) => {
  try {
    const show = await Show.findById(req.params.id)
      .populate('theaterId', 'name location city contactNumber');
    
    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }

    res.json({ success: true, data: show });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all theaters (Public)
// @route   GET /api/public/theaters
const getAllTheaters = async (req, res) => {
  try {
    const { city } = req.query;
    let filter = { status: 'ACTIVE' };
    if (city) filter.city = city;

    const theaters = await Theater.find(filter).populate('ownerId', 'name email');
    res.json({ success: true, count: theaters.length, data: theaters });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllShows,
  getTrendingShows,
  getShowById,
  getAllTheaters
};