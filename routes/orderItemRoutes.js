const express = require('express')
const { body, param, validationResult } = require('express-validator')
const orderItemService = require('../service/orderItemService')
const verifyToken = require('../middlewares/verifyToken')
const { handleValidationErrors } = require('../utils/validations')
const router = express.Router()

/**
 * @swagger
 * tags:
 *   name: OrderItems
 *   description: Order item management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     OrderItem:
 *       type: object
 *       required:
 *         - flowerId
 *         - quantity
 *         - orderId
 *       properties:
 *         flowerId:
 *           type: string
 *           description: ID of the flower
 *         quantity:
 *           type: integer
 *           minimum: 1
 *           description: Quantity of the flower
 *         orderId:
 *           type: string
 *           description: ID of the order
 *       example:
 *         flowerId: "60f7b1234567890123456789"
 *         quantity: 2
 *         orderId: "60f7b1234567890123456790"
 *     OrderItemResponse:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         flowerId:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *             price:
 *               type: number
 *         orderId:
 *           type: string
 *         quantity:
 *           type: integer
 *         actualPrice:
 *           type: number
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/order-items:
 *   post:
 *     summary: Create a new order item
 *     tags: [OrderItems]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OrderItem'
 *     responses:
 *       201:
 *         description: Order item created successfully
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
 *                   $ref: '#/components/schemas/OrderItemResponse'
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
        body('flowerId').isMongoId().withMessage('Valid flower ID is required'),
        body('quantity')
            .isInt({ min: 1 })
            .withMessage('Quantity must be at least 1'),
        body('orderId').isMongoId().withMessage('Valid order ID is required'),
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const orderItem = await orderItemService.createOrderItem(req.body)
            res.status(201).json({
                success: true,
                message: 'Order item created successfully',
                data: orderItem,
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
 * /api/order-items/order/{orderId}:
 *   get:
 *     summary: Get order items by order ID
 *     tags: [OrderItems]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     responses:
 *       200:
 *         description: Order items retrieved successfully
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
 *                     $ref: '#/components/schemas/OrderItemResponse'
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.get(
    '/order/:orderId',
    verifyToken,
    [param('orderId').isMongoId().withMessage('Valid order ID is required')],
    handleValidationErrors,
    async (req, res) => {
        try {
            const orderItems = await orderItemService.getOrderItemsByOrderId(
                req.params.orderId
            )
            res.json({
                success: true,
                message: 'Order items retrieved successfully',
                data: orderItems,
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
 * /api/order-items/{id}:
 *   get:
 *     summary: Get order item by ID
 *     tags: [OrderItems]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order item ID
 *     responses:
 *       200:
 *         description: Order item retrieved successfully
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
 *                   $ref: '#/components/schemas/OrderItemResponse'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Order item not found
 *       422:
 *         description: Validation error
 */
router.get(
    '/:id',
    verifyToken,
    [param('id').isMongoId().withMessage('Valid order item ID is required')],
    handleValidationErrors,
    async (req, res) => {
        try {
            const orderItem = await orderItemService.getOrderItemById(
                req.params.id
            )
            res.json({
                success: true,
                message: 'Order item retrieved successfully',
                data: orderItem,
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
 * /api/order-items/{id}:
 *   put:
 *     summary: Update order item (only if order is still pending)
 *     tags: [OrderItems]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order item ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 description: New quantity for the item
 *           example:
 *             quantity: 3
 *     responses:
 *       200:
 *         description: Order item updated successfully
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
 *                   $ref: '#/components/schemas/OrderItemResponse'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation error
 */
router.put(
    '/:id',
    verifyToken,
    [
        param('id').isMongoId().withMessage('Valid order item ID is required'),
        body('quantity')
            .optional()
            .isInt({ min: 1 })
            .withMessage('Quantity must be at least 1'),
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const orderItem = await orderItemService.updateOrderItem(
                req.params.id,
                req.body
            )
            res.json({
                success: true,
                message: 'Order item updated successfully',
                data: orderItem,
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
 * /api/order-items/{id}:
 *   delete:
 *     summary: Delete order item (only if order is still pending)
 *     tags: [OrderItems]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order item ID
 *     responses:
 *       200:
 *         description: Order item deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation error
 */
router.delete(
    '/:id',
    verifyToken,
    [param('id').isMongoId().withMessage('Valid order item ID is required')],
    handleValidationErrors,
    async (req, res) => {
        try {
            const result = await orderItemService.deleteOrderItem(req.params.id)
            res.json({
                success: true,
                message: result.message,
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
