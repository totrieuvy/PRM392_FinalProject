const express = require("express");
const router = express.Router();
const profileService = require("../service/profileService");
const verifyToken = require("../middlewares/verifyToken");

/**
 * @swagger
 * tags:
 *   name: Profile
 *   description: API for managing user profiles
 */

/**
 * @swagger
 * /api/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 fullName:
 *                   type: string
 *                 email:
 *                   type: string
 *                 phone:
 *                   type: string
 *                 avatar:
 *                   type: string
 *                 role:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Profile not found
 *       500:
 *         description: Internal server error
 */
router.get("/", verifyToken, async (req, res, next) => {
  try {
    const userId = req.userId;
    const profile = await profileService.getProfile(userId);
    res.status(200).json(profile);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - phone
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               avatar:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully updated profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 fullName:
 *                   type: string
 *                 email:
 *                   type: string
 *                 phone:
 *                   type: string
 *                 avatar:
 *                   type: string
 *                 role:
 *                   type: string
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put("/", verifyToken, async (req, res, next) => {
  try {
    const userId = req.userId;
    const profileData = req.body;

    // Validate input data
    if (!profileData.fullName || !profileData.email || !profileData.phone) {
      return res.status(400).json({ message: "Full name, email, and phone are required." });
    }

    const updatedProfile = await profileService.updateProfile(userId, profileData);
    res.status(200).json(updatedProfile);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
