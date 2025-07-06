const express = require('express')
const { body, param, query, validationResult } = require('express-validator')
const orderService = require('../service/orderService')
const verifyToken = require('../middlewares/verifyToken')
const { handleValidationErrors } = require('../utils/validations')
const router = express.Router()

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Order management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     OrderItem:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Order item ID
 *         flowerId:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *               description: Flower ID
 *             name:
 *               type: string
 *               description: Flower name
 *             image:
 *               type: string
 *               description: Flower image URL
 *             description:
 *               type: string
 *               description: Flower description
 *         actualPrice:
 *           type: number
 *           description: Price at the time of order
 *         quantity:
 *           type: integer
 *           description: Quantity ordered
 *       example:
 *         _id: "60f7b1234567890123456abc"
 *         flowerId:
 *           _id: "60f7b1234567890123456789"
 *           name: "Hoa Hồng Đỏ"
 *           image: "rose.jpg"
 *           description: "Hoa hồng đẹp"
 *         actualPrice: 50000
 *         quantity: 2
 *     Order:
 *       type: object
 *       required:
 *         - items
 *         - addressShip
 *       properties:
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               flowerId:
 *                 type: string
 *                 description: ID of the flower
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 description: Quantity of the flower
 *         addressShip:
 *           type: string
 *           description: Shipping address
 *         shippingFee:
 *           type: number
 *           description: Shipping fee (optional)
 *       example:
 *         items:
 *           - flowerId: "60f7b1234567890123456789"
 *             quantity: 2
 *         addressShip: "123 Main St, City, Country"
 *         shippingFee: 10.99
 *     OrderResponse:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         accountId:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             fullName:
 *               type: string
 *             email:
 *               type: string
 *             phone:
 *               type: string
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/OrderItem'
 *         totalAmount:
 *           type: number
 *         shippingFee:
 *           type: number
 *         addressShip:
 *           type: string
 *         status:
 *           type: string
 *           enum: [pending, paid, confirmed, shipped, delivered, cancelled]
 *         transactionId:
 *           type: string
 *           description: Associated transaction ID
 *         paymentCode:
 *           type: string
 *           description: Payment code for PayOS
 *         proofOfDelivery:
 *           type: string
 *           description: Proof of delivery URL/text
 *         orderAt:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Create a new order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Order'
 *     responses:
 *       201:
 *         description: Order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/OrderResponse'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation error
 */
router.post(
    '/',
    verifyToken,
    [
        body('items')
            .isArray({ min: 1 })
            .withMessage('Items must be an array with at least one item'),
        body('items.*.flowerId')
            .isMongoId()
            .withMessage('Valid flower ID is required'),
        body('items.*.quantity')
            .isInt({ min: 1 })
            .withMessage('Quantity must be at least 1'),
        body('addressShip')
            .notEmpty()
            .withMessage('Shipping address is required'),
        body('shippingFee')
            .optional()
            .isNumeric()
            .withMessage('Shipping fee must be a number'),
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const order = await orderService.createOrder(req.body, req.userId)
            res.status(201).json({
                success: true,
                message: 'Order created successfully',
                data: order,
            })
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message,
            })
        }
    }
)

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Get orders with optional filters
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, shipped, delivered, cancelled]
 *         description: Filter by order status
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter (ISO format)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter (ISO format)
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID (admin only)
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/OrderResponse'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
    '/',
    verifyToken,
    [
        query('status')
            .optional()
            .isIn(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'])
            .withMessage(
                'Status must be one of: pending, confirmed, shipped, delivered, cancelled'
            ),
        query('startDate')
            .optional()
            .isISO8601()
            .withMessage('Start date must be valid ISO date'),
        query('endDate')
            .optional()
            .isISO8601()
            .withMessage('End date must be valid ISO date'),
        query('userId')
            .optional()
            .isMongoId()
            .withMessage('User ID must be valid'),
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { status, startDate, endDate, userId } = req.query
            const filters = { status, startDate, endDate }

            let targetUserId = null

            if (req.userRole !== 'admin') {
                targetUserId = req.userId
            } else if (userId) {
                targetUserId = userId
            }

            const orders = await orderService.getOrders(filters, targetUserId)
            res.json({
                success: true,
                message: 'Orders retrieved successfully',
                data: orders,
            })
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message,
            })
        }
    }
)

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Get order details by ID
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     responses:
 *       200:
 *         description: Order details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/OrderResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Permission denied
 *       404:
 *         description: Order not found
 */
router.get(
    '/:id',
    verifyToken,
    [param('id').isMongoId().withMessage('Valid order ID is required')],
    handleValidationErrors,
    async (req, res) => {
        try {
            const order = await orderService.getOrderById(req.params.id)

            if (
                req.userRole !== 'admin' &&
                order.accountId._id.toString() !== req.userId
            ) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied',
                })
            }

            res.json({
                success: true,
                message: 'Order details retrieved successfully',
                data: order,
            })
        } catch (error) {
            res.status(404).json({
                success: false,
                message: error.message,
            })
        }
    }
)

/**
 * @swagger
 * /api/orders/{id}/status:
 *   patch:
 *     summary: Update order status
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, confirmed, shipped, delivered, cancelled]
 *                 description: New order status
 *           example:
 *             status: "confirmed"
 *     responses:
 *       200:
 *         description: Order status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/OrderResponse'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation error
 */
router.patch(
    '/:id/status',
    verifyToken,
    [
        param('id').isMongoId().withMessage('Valid order ID is required'),
        body('status')
            .isIn(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'])
            .withMessage(
                'Status must be one of: pending, confirmed, shipped, delivered, cancelled'
            ),
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { status } = req.body
            const updatedOrder = await orderService.updateOrderStatus(
                req.params.id,
                status,
                req.userId
            )

            res.json({
                success: true,
                message: 'Order status updated successfully',
                data: updatedOrder,
            })
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message,
            })
        }
    }
)

/**
 * @swagger
 * /api/orders/{id}/proof:
 *   patch:
 *     summary: Update proof of delivery
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - proofOfDelivery
 *             properties:
 *               proofOfDelivery:
 *                 type: string
 *                 description: Proof of delivery information
 *           example:
 *             proofOfDelivery: "https://example.com/delivery-proof.jpg"
 *     responses:
 *       200:
 *         description: Proof of delivery updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/OrderResponse'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation error
 */
router.patch(
    '/:id/proof',
    verifyToken,
    [
        param('id').isMongoId().withMessage('Valid order ID is required'),
        body('proofOfDelivery')
            .notEmpty()
            .withMessage('Proof of delivery is required'),
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { proofOfDelivery } = req.body
            const updatedOrder = await orderService.updateProofOfDelivery(
                req.params.id,
                proofOfDelivery,
                req.userId
            )

            res.json({
                success: true,
                message: 'Proof of delivery updated successfully',
                data: updatedOrder,
            })
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message,
            })
        }
    }
)

/**
 * @swagger
 * /api/orders/{id}/paid:
 *   patch:
 *     summary: Update payment status
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               transactionId:
 *                 type: string
 *                 description: Transaction ID (optional)
 *           example:
 *             transactionId: "60f7b1234567890123456789"
 *     responses:
 *       200:
 *         description: Payment status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/OrderResponse'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation error
 */
router.patch(
    '/:id/paid',
    verifyToken,
    [
        param('id').isMongoId().withMessage('Valid order ID is required'),
        body('transactionId')
            .optional()
            .isMongoId()
            .withMessage('Valid transaction ID is required'),
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { transactionId } = req.body
            const updatedOrder = await orderService.updatePaymentStatus(
                req.params.id,
                transactionId
            )

            res.json({
                success: true,
                message: 'Payment status updated successfully',
                data: updatedOrder,
            })
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message,
            })
        }
    }
)

module.exports = router
