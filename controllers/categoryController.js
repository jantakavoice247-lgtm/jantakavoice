const Category = require('../models/Category');
const Post = require('../models/Post');

// ============================================================
// GET ALL CATEGORIES
// ============================================================
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ name: 1 }).select('-__v');

    const categoryCounts = {};
    for (const cat of categories) {
      const count = await Post.countDocuments({
        category: cat.name,
        status: 'approved',
      });
      categoryCounts[cat.name] = count;
    }

    res.json({
      success: true,
      categories: categories,
      counts: categoryCounts,
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories.',
    });
  }
};

// ============================================================
// CREATE CATEGORY (Admin only)
// ============================================================
const createCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required.',
      });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const category = await Category.create({ name: name.trim(), slug });

    res.status(201).json({
      success: true,
      message: 'Category created successfully.',
      category: category,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Category already exists.',
      });
    }
    console.error('Create category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create category.',
    });
  }
};

// ============================================================
// UPDATE CATEGORY (Admin only)
// ============================================================
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required.',
      });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.',
      });
    }

    const oldName = category.name;
    category.name = name.trim();
    category.slug = slug;
    await category.save();

    await Post.updateMany({ category: oldName }, { category: name.trim() });

    res.json({
      success: true,
      message: 'Category updated successfully.',
      category: category,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Category name already exists.',
      });
    }
    console.error('Update category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update category.',
    });
  }
};

// ============================================================
// DELETE CATEGORY (Admin only)
// ============================================================
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.',
      });
    }

    const postsCount = await Post.countDocuments({
      category: category.name,
      status: 'approved',
    });

    if (postsCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category "${category.name}". ${postsCount} post(s) use this category.`,
      });
    }

    await category.deleteOne();

    res.json({
      success: true,
      message: 'Category deleted successfully.',
    });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete category.',
    });
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};