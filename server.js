require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const adminRoutes = require('./routes/adminRoutes');
const reportRoutes = require('./routes/reportRoutes');
const categoryRoutes = require('./routes/categoryRoutes');

// Import Instagram functions from adminController
const { retryInstagram, getInstagramStatus } = require('./controllers/adminController');
const protect = require('./middleware/authMiddleware');
const admin = require('./middleware/adminMiddleware');

// Initialize express
const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// ============================================================
// MIDDLEWARE
// ============================================================

// Security - Allow iframe for CORS
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.',
});
app.use('/api', limiter);

// ============================================================
// CORS - COMPLETE FIX
// ============================================================

// Allow all origins for development (you can restrict in production)
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        
        // Allow all localhost origins
        if (origin.match(/^http:\/\/localhost:\d+$/) || 
            origin.match(/^http:\/\/127\.0\.0\.1:\d+$/)) {
            return callback(null, true);
        }
        
        // Allow specific origins
        const allowedOrigins = [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:5500',
            'http://127.0.0.1:5500',
            'http://localhost:5000',
            'http://127.0.0.1:5000',
        ];
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn('CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400,
};

// Apply CORS
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Log CORS requests for debugging
app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.url} from ${req.headers.origin || 'unknown'}`);
    next();
});

// ============================================================
// BODY PARSERS
// ============================================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ============================================================
// ROUTES
// ============================================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Server is running',
        timestamp: new Date().toISOString(),
    });
});

// Test CORS endpoint
app.get('/api/test-cors', (req, res) => {
    res.json({
        success: true,
        message: 'CORS is working!',
        origin: req.headers.origin || 'No origin'
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/admin', adminRoutes);

// ============================================================
// INSTAGRAM ROUTES (Direct registration - fallback)
// ============================================================
console.log('📸 Registering Instagram routes...');
app.get('/api/admin/posts/:id/instagram/status', protect, admin, getInstagramStatus);
app.post('/api/admin/posts/:id/instagram/retry', protect, admin, retryInstagram);
console.log('✅ Instagram routes registered');

// ============================================================
// ERROR HANDLING
// ============================================================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
});

app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: messages,
        });
    }

    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(400).json({
            success: false,
            message: `Duplicate value for ${field}. Please use a different value.`,
        });
    }

    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Invalid token. Please login again.',
        });
    }

    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal server error',
    });
});

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}/api`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ CORS enabled for all localhost origins`);
});