const express = require("express");
const router = express.Router();
const Flower = require("../models/Flower");
const Category = require("../models/Category");
const verifyToken = require("../middlewares/verifyToken");
const httpErrors = require("http-errors");
const { default: mongoose } = require("mongoose");

/**
 * @swagger
 * /api/flowers:
 *   post:
 *     summary: Create a new flower
 *     tags: [Flowers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *               - description
 *               - image
 *               - category
 *               - stock
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *               description:
 *                 type: string
 *               image:
 *                 type: string
 *               category:
 *                 type: string
 *               stock:
 *                 type: number
 *     responses:
 *       201:
 *         description: Flower created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post("/", verifyToken, async (req, res, next) => {
  try {
    const { name, price, description, image, category, stock } = req.body;

    // Validate required fields
    if (!name || !price || !description || !image || !category) {
      return next(httpErrors.BadRequest("All fields are required"));
    }

    // Validate price and stock
    if (price <= 0) {
      return next(httpErrors.BadRequest("Price must be greater than 0"));
    }
    if (stock < 0) {
      return next(httpErrors.BadRequest("Stock cannot be negative"));
    }

    // Check if category exists and is active
    const categoryExists = await Category.findOne({ _id: category, isActive: true });
    if (!categoryExists) {
      return next(httpErrors.NotFound("Category not found or inactive"));
    }

    const flower = new Flower({
      name,
      price,
      description,
      image,
      category,
      stock,
      createBy: req.userId,
    });

    await flower.save();
    res.status(201).json(flower);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/flowers:
 *   get:
 *     summary: Get all active flowers
 *     tags: [Flowers]
 *     responses:
 *       200:
 *         description: List of flowers
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Flower'
 */
router.get("/", async (req, res, next) => {
  try {
    const flowers = await Flower.find({ isActive: true }).populate("category", "name").populate("createBy", "fullName");
    res.json(flowers);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/flowers/category/{categoryId}:
 *   get:
 *     summary: Get all active flowers by category ID
 *     tags: [Flowers]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the category
 *     responses:
 *       200:
 *         description: List of flowers in the specified category
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Flower'
 *       400:
 *         description: Invalid category ID
 *       404:
 *         description: Category not found or inactive
 */
router.get("/category/:categoryId", async (req, res, next) => {
  try {
    const { categoryId } = req.params;

    // Validate category ID
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return next(httpErrors.BadRequest("Invalid category ID"));
    }

    // Check if category exists and is active
    const categoryExists = await Category.findOne({ _id: categoryId, isActive: true });
    if (!categoryExists) {
      return next(httpErrors.NotFound("Category not found or inactive"));
    }

    // Find active flowers in the category
    const flowers = await Flower.find({ category: categoryId, isActive: true })
      .populate("category", "name")
      .populate("createBy", "fullName");

    res.json(flowers);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/flowers/{id}:
 *   get:
 *     summary: Get a flower by ID
 *     tags: [Flowers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Flower details
 *       404:
 *         description: Flower not found
 */
router.get("/:id", async (req, res, next) => {
  try {
    const flower = await Flower.findOne({ _id: req.params.id, isActive: true })
      .populate("category", "name")
      .populate("createBy", "fullName");
    if (!flower) {
      return next(httpErrors.NotFound("Flower not found"));
    }
    res.json(flower);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/flowers/{id}:
 *   put:
 *     summary: Update a flower's name, price, description, image, and stock
 *     tags: [Flowers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *               - description
 *               - image
 *               - stock
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *               description:
 *                 type: string
 *               image:
 *                 type: string
 *               stock:
 *                 type: number
 *     responses:
 *       200:
 *         description: Flower updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Flower not found
 */
router.put("/:id", verifyToken, async (req, res, next) => {
  try {
    const { name, price, description, image, stock } = req.body;

    // Validate required fields
    if (!name || !price || !description || !image || stock === undefined) {
      return next(httpErrors.BadRequest("All fields (name, price, description, image, stock) are required"));
    }

    // Validate price and stock
    if (price <= 0) {
      return next(httpErrors.BadRequest("Price must be greater than 0"));
    }
    if (stock < 0) {
      return next(httpErrors.BadRequest("Stock cannot be negative"));
    }

    const flower = await Flower.findOne({ _id: req.params.id, createBy: req.userId });
    if (!flower) {
      return next(httpErrors.NotFound("Flower not found or unauthorized"));
    }

    // Update only specified fields
    flower.name = name;
    flower.price = price;
    flower.description = description;
    flower.image = image;
    flower.stock = stock;

    await flower.save();
    res.json(flower);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/flowers/{id}:
 *   delete:
 *     summary: Soft delete a flower
 *     tags: [Flowers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Flower deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Flower not found
 */
router.delete("/:id", verifyToken, async (req, res, next) => {
  try {
    const flower = await Flower.findOne({ _id: req.params.id, createBy: req.userId });
    if (!flower) {
      return next(httpErrors.NotFound("Flower not found or unauthorized"));
    }

    flower.isActive = false;
    await flower.save();
    res.json({ message: "Flower deleted successfully" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
