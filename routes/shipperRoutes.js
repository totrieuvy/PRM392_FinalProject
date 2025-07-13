const express = require("express");
const router = express.Router();
const shipperService = require("../service/shippperService");
const verifyToken = require("../middlewares/verifyToken");
const multer = require("multer");

// Configure Multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * /api/shippers:
 *   get:
 *     summary: Get all shipper accounts
 *     tags: [Shippers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of shipper accounts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Account'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/", async (req, res) => {
  try {
    const shippers = await shipperService.getShippers();
    res.status(200).json(shippers);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving shippers", error: error.message });
  }
});

/**
 * @swagger
 * /api/shippers/{orderId}/assign-shipper:
 *   put:
 *     summary: Assign a shipper to an order
 *     tags: [Shippers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the order to assign a shipper to
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - shipperId
 *             properties:
 *               shipperId:
 *                 type: string
 *                 description: ID of the shipper to assign
 *     responses:
 *       200:
 *         description: Shipper assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         description: Invalid order ID or shipper ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Order or shipper not found
 *       500:
 *         description: Server error
 */
router.put("/:orderId/assign-shipper", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { shipperId } = req.body;
    const updatedOrder = await shipperService.assignShipper(orderId, shipperId);
    res.status(200).json(updatedOrder);
  } catch (error) {
    if (error.message.includes("not found")) {
      res.status(404).json({ message: error.message });
    } else if (error.message.includes("Invalid")) {
      res.status(400).json({ message: error.message });
    } else {
      res.status(500).json({ message: "Error assigning shipper", error: error.message });
    }
  }
});

/**
 * @swagger
 * /api/shippers/my-orders:
 *   get:
 *     summary: Get orders assigned to the logged-in shipper
 *     tags: [Shippers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of orders assigned to the shipper
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Order'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - User is not a shipper
 *       500:
 *         description: Server error
 */
router.get("/my-orders", verifyToken, async (req, res) => {
  try {
    if (req.userRole !== "shipper") {
      return res.status(403).json({ message: "Forbidden: Only shippers can access this endpoint" });
    }
    const orders = await shipperService.getAssignedOrders(req.userId);
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving assigned orders", error: error.message });
  }
});

/**
 * @swagger
 * /api/shippers/{orderId}/complete-delivery:
 *   put:
 *     summary: Update order with proof of delivery and mark as delivered
 *     tags: [Shippers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the order to mark as delivered
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - proofImage
 *             properties:
 *               proofImage:
 *                 type: string
 *                 format: binary
 *                 description: Image file as proof of delivery
 *     responses:
 *       200:
 *         description: Order marked as delivered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         description: Invalid order ID or missing image
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - User is not a shipper or not assigned to this order
 *       404:
 *         description: Order not found
 *       500:
 *         description: Server error
 */
router.put("/:orderId/complete-delivery", verifyToken, upload.single("proofImage"), async (req, res) => {
  try {
    if (req.userRole !== "shipper") {
      return res.status(403).json({ message: "Forbidden: Only shippers can access this endpoint" });
    }
    if (!req.file) {
      return res.status(400).json({ message: "Proof image is required" });
    }
    const { orderId } = req.params;
    const updatedOrder = await shipperService.completeDelivery(orderId, req.userId, req.file);
    res.status(200).json(updatedOrder);
  } catch (error) {
    if (error.message.includes("not found")) {
      res.status(404).json({ message: error.message });
    } else if (error.message.includes("Invalid")) {
      res.status(400).json({ message: error.message });
    } else if (error.message.includes("Forbidden")) {
      res.status(403).json({ message: error.message });
    } else {
      res.status(500).json({ message: "Error completing delivery", error: error.message });
    }
  }
});

module.exports = router;
