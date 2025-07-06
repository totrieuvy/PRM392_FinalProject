const express = require('express')
const { body, param, query, validationResult } = require('express-validator')
const paymentService = require('../service/paymentService')
const verifyToken = require('../middlewares/verifyToken')
const { handleValidationErrors } = require('../utils/validations')
const router = express.Router()

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment processing endpoints using PayOS
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     PaymentLinkRequest:
 *       type: object
 *       required:
 *         - orderId
 *       properties:
 *         orderId:
 *           type: string
 *           description: ID of the order to create payment for
 *         returnUrl:
 *           type: string
 *           description: URL to redirect after successful payment (optional)
 *         cancelUrl:
 *           type: string
 *           description: URL to redirect after cancelled payment (optional)
 *       example:
 *         orderId: "60f7b1234567890123456789"
 *         returnUrl: "http://localhost:3000/payment/success"
 *         cancelUrl: "http://localhost:3000/payment/cancel"
 *     PaymentLinkResponse:
 *       type: object
 *       properties:
 *         checkoutUrl:
 *           type: string
 *           description: URL for customer to complete payment
 *         paymentCode:
 *           type: string
 *           description: Unique payment code
 *         transactionId:
 *           type: string
 *           description: Transaction ID
 *         orderId:
 *           type: string
 *           description: Order ID
 *         amount:
 *           type: number
 *           description: Payment amount
 *         qrCode:
 *           type: string
 *           description: QR code for payment
 *         paymentLinkId:
 *           type: string
 *           description: PayOS payment link ID
 */

/**
 * @swagger
 * /api/payments/create-payment-link:
 *   post:
 *     summary: Create payment link for an order
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaymentLinkRequest'
 *     responses:
 *       200:
 *         description: Payment link created successfully
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
 *                   $ref: '#/components/schemas/PaymentLinkResponse'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation error
 */
router.post(
    '/create-payment-link',
    verifyToken,
    [
        body('orderId').isMongoId().withMessage('Valid order ID is required'),
        body('returnUrl')
            .optional()
            .custom((value) => {
                if (value && !value.match(/^https?:\/\/.+/)) {
                    throw new Error(
                        'Return URL must start with http:// or https://'
                    )
                }
                return true
            }),
        body('cancelUrl')
            .optional()
            .custom((value) => {
                if (value && !value.match(/^https?:\/\/.+/)) {
                    throw new Error(
                        'Cancel URL must start with http:// or https://'
                    )
                }
                return true
            }),
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const paymentLinkData = await paymentService.createPaymentLink(
                req.body
            )

            res.json({
                success: true,
                message: 'Payment link created successfully',
                data: paymentLinkData,
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
 * /api/payments/payment/success:
 *   get:
 *     summary: Handle successful payment return from PayOS
 *     tags: [Payments]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Payment result code
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         description: Payment ID
 *       - in: query
 *         name: orderCode
 *         schema:
 *           type: string
 *         description: Order code
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Payment status
 *       - in: query
 *         name: amount
 *         schema:
 *           type: string
 *         description: Payment amount
 *     responses:
 *       302:
 *         description: Redirect to success page
 *       default:
 *         description: Redirect to failure page on error
 */
router.get('/payment/success', async (req, res) => {
    try {
        const result = await paymentService.handlePaymentReturn(req.query)

        // Redirect to success page with parameters
        const params = new URLSearchParams({
            orderId: result.orderId || '',
            orderCode: result.orderCode || '',
            status: result.status || 'PAID',
            amount: req.query.amount || '',
            code: req.query.code || '00',
        })

        res.redirect(`/payment-success.html?${params.toString()}`)
    } catch (error) {
        // Redirect to failure page with error
        const params = new URLSearchParams({
            orderCode: req.query.orderCode || '',
            error: error.message || 'Unknown error',
        })

        res.redirect(`/payment-failure.html?${params.toString()}`)
    }
})

/**
 * @swagger
 * /api/payments/payment/cancel:
 *   get:
 *     summary: Handle cancelled payment return from PayOS
 *     tags: [Payments]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Payment result code
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         description: Payment ID
 *       - in: query
 *         name: orderCode
 *         schema:
 *           type: string
 *         description: Order code
 *       - in: query
 *         name: cancel
 *         schema:
 *           type: string
 *         description: Cancel flag
 *       - in: query
 *         name: amount
 *         schema:
 *           type: string
 *         description: Payment amount
 *     responses:
 *       302:
 *         description: Redirect to failure page
 *       default:
 *         description: Redirect to failure page on error
 */
router.get('/payment/cancel', async (req, res) => {
    try {
        const result = await paymentService.handlePaymentReturn(req.query)

        // Redirect to failure page with cancellation info
        const params = new URLSearchParams({
            orderId: result.orderId || '',
            orderCode: result.orderCode || '',
            cancel: 'true',
            amount: req.query.amount || '',
        })

        res.redirect(`/payment-failure.html?${params.toString()}`)
    } catch (error) {
        // Redirect to failure page with error
        const params = new URLSearchParams({
            orderCode: req.query.orderCode || '',
            error: error.message || 'Unknown error',
            cancel: 'true',
        })

        res.redirect(`/payment-failure.html?${params.toString()}`)
    }
})

/**
 * @swagger
 * /api/payments/payments/webhook:
 *   post:
 *     summary: Handle PayOS webhook notifications
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderCode:
 *                 type: string
 *                 description: Order code
 *               status:
 *                 type: string
 *                 description: Payment status
 *               amount:
 *                 type: number
 *                 description: Payment amount
 *               description:
 *                 type: string
 *                 description: Payment description
 *           example:
 *             orderCode: "123456789"
 *             status: "PAID"
 *             amount: 100000
 *             description: "Payment for Order #60f7b1234567890123456789"
 *     responses:
 *       200:
 *         description: Webhook processed successfully
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
 *                   type: object
 *                   properties:
 *                     orderCode:
 *                       type: string
 *                     status:
 *                       type: string
 *       400:
 *         description: Bad request
 */
router.post('/payments/webhook', async (req, res) => {
    try {
        const result = await paymentService.handlePaymentWebhook(req.body)
        res.json({
            success: true,
            message: result.message,
            data: {
                orderCode: result.orderCode,
                status: result.status,
            },
        })
    } catch (error) {
        console.error('Webhook error:', error)
        res.status(400).json({
            success: false,
            message: error.message,
        })
    }
})

/**
 * @swagger
 * /api/payments/payment-info/{paymentCode}:
 *   get:
 *     summary: Get payment link information
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment code
 *     responses:
 *       200:
 *         description: Payment information retrieved successfully
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
 *                   type: object
 *                   description: Payment information from PayOS
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation error
 */
router.get(
    '/payment-info/:paymentCode',
    verifyToken,
    [param('paymentCode').notEmpty().withMessage('Payment code is required')],
    handleValidationErrors,
    async (req, res) => {
        try {
            const paymentInfo = await paymentService.getPaymentLinkInfo(
                req.params.paymentCode
            )
            res.json({
                success: true,
                message: 'Payment information retrieved successfully',
                data: paymentInfo,
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
 * /api/payments/cancel-payment/{paymentCode}:
 *   post:
 *     summary: Cancel payment link
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment code
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for cancellation (optional)
 *           example:
 *             reason: "Customer request"
 *     responses:
 *       200:
 *         description: Payment cancelled successfully
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
 *                   type: object
 *                   description: Cancellation result from PayOS
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation error
 */
router.post(
    '/cancel-payment/:paymentCode',
    verifyToken,
    [
        param('paymentCode').notEmpty().withMessage('Payment code is required'),
        body('reason')
            .optional()
            .isString()
            .withMessage('Reason must be a string'),
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { reason } = req.body
            const result = await paymentService.cancelPaymentLink(
                req.params.paymentCode,
                reason
            )
            res.json({
                success: true,
                message: 'Payment cancelled successfully',
                data: result,
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
