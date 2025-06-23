const express = require("express");
const router = express.Router();
const categoryService = require("../service/categoryService");
const { body, validationResult } = require("express-validator");
const verifyToken = require("../middlewares/verifyToken");

/**
 * @swagger
 * /api/categories:
 *   post:
 *     summary: Create a new category
 *     tags: [Category]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: string
 *     responses:
 *       201:
 *         description: Category created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Category created successfully
 *       400:
 *         description: Validation error
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: Name is required
 */
router.post(
  "/",
  verifyToken,
  [body("name").trim().notEmpty().withMessage("Name is required")],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).send(errors.array()[0].msg);
    }
    try {
      const { name } = req.body;
      await categoryService.createCategory(name);
      res.status(201).json({ message: "Category created successfully" });
    } catch (error) {
      return res.status(400).send(error.message);
    }
  }
);

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Get all categories
 *     tags: [Category]
 *     responses:
 *       200:
 *         description: List of all categories
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                     example: 60d5f8c8b1b2e8a4f8c8b1b2
 *                   name:
 *                     type: string
 *                     example: Roses
 *                   isActive:
 *                     type: boolean
 *                     example: true
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *       400:
 *         description: Error occurred
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: Failed to fetch categories
 */
router.get("/", async (req, res, next) => {
  try {
    const categories = await categoryService.getAllCategories();
    res.json(categories);
  } catch (error) {
    return res.status(400).send(error.message);
  }
});

/**
 * @swagger
 * /api/categories/{id}:
 *   put:
 *     summary: Update a category
 *     tags: [Category]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: string
 *               isActive:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Category updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Category updated successfully
 *       400:
 *         description: Validation error or category not found
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: Category not found
 */
router.put(
  "/:id",
  verifyToken,
  [body("name").optional().trim().notEmpty().withMessage("Name is required")],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).send(errors.array()[0].msg);
    }
    try {
      const { id } = req.params;
      const { name, isActive } = req.body;
      await categoryService.updateCategory(id, { name, isActive });
      res.json({ message: "Category updated successfully" });
    } catch (error) {
      return res.status(400).send(error.message);
    }
  }
);

/**
 * @swagger
 * /api/categories/{id}:
 *   delete:
 *     summary: Delete a category
 *     tags: [Category]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Category deleted successfully
 *       400:
 *         description: Category not found
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: Category not found
 */
router.delete("/:id", verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    await categoryService.deleteCategory(id);
    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    return res.status(400).send(error.message);
  }
});

module.exports = router;
