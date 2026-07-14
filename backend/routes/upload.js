const { upload } = require('../config/cloudinary');

// Upload endpoint
router.post('/upload', upload.single('image'), (req, res) => {
  try {
    // Cloudinary automatically returns the URL
    res.json({
      success: true,
      imageUrl: req.file.path, // This is the Cloudinary URL
      publicId: req.file.filename
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});