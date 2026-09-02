// scripts/seed.js - Complete

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const connectDB = require('../config/db');

const User = require('../models/User');
const Post = require('../models/Post');
const Report = require('../models/Report');
const Category = require('../models/Category');

function generateAnonymousId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'PP';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const seedData = async () => {
  try {
    await connectDB();

    // Create Admin User if not exists
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@peoplespress.com';
    let admin = await User.findOne({ email: adminEmail });
    
    if (!admin) {
      const adminPasswordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
      admin = await User.create({
        name: 'Admin User',
        email: adminEmail,
        phone: process.env.ADMIN_PHONE || '+91 98765 43210',
        passwordHash: adminPasswordHash,
        role: 'admin',
        anonymousId: generateAnonymousId(),
        isActive: true,
      });
      console.log(`👤 Admin created: ${admin.email} (${admin.anonymousId})`);
    } else {
      console.log(`👤 Admin already exists: ${admin.email}`);
    }

    // Create default categories if they don't exist
    const categoryNames = ['Politics', 'Education', 'Environment', 'Infrastructure', 'Health', 'Crime', 'Others'];
    for (const name of categoryNames) {
      const exists = await Category.findOne({ name });
      if (!exists) {
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        await Category.create({ name, slug });
        console.log(`📁 Created category: ${name}`);
      }
    }

    console.log('\n✅ Seeding complete!');
    console.log('\n📋 Admin Credentials:');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${process.env.ADMIN_PASSWORD || 'admin123'}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error.message);
    process.exit(1);
  }
};

seedData();