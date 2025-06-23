const Category = require("../models/Category");

const categoryService = {
  async createCategory(name) {
    try {
      if (!name || name.trim() === "") {
        throw new Error("Name is required");
      }
      const category = new Category({ name });
      await category.save();
      return category;
    } catch (error) {
      throw error;
    }
  },

  async getAllCategories() {
    try {
      const categories = await Category.find();
      return categories;
    } catch (error) {
      throw new Error("Failed to fetch categories");
    }
  },

  async updateCategory(id, { name, isActive }) {
    try {
      const category = await Category.findById(id);
      if (!category) {
        throw new Error("Category not found");
      }
      if (name && (!name.trim() || name.trim() === "")) {
        throw new Error("Name is required");
      }
      category.name = name || category.name;
      category.isActive = isActive !== undefined ? isActive : category.isActive;
      await category.save();
      return category;
    } catch (error) {
      throw error;
    }
  },

  async deleteCategory(id) {
    try {
      const category = await Category.findById(id);
      if (!category) {
        throw new Error("Category not found");
      }
      category.isActive = false;
      await category.save();
    } catch (error) {
      throw error;
    }
  },
};

module.exports = categoryService;
