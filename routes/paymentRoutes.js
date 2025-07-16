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
 *     summary: Handle successful payment return from PayOS (Mobile Deep Link)
 *     description: Automatically redirects to mobile app deep link with payment result
 *     tags: [Payments]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Payment result code from PayOS
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         description: Transaction ID from PayOS
 *       - in: query
 *         name: orderCode
 *         schema:
 *           type: string
 *         description: Order code from PayOS
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Payment status from PayOS
 *       - in: query
 *         name: amount
 *         schema:
 *           type: string
 *         description: Payment amount from PayOS
 *     responses:
 *       302:
 *         description: Redirects to mobile app deep link
 *         headers:
 *           Location:
 *             description: Deep link URL (myapp://payment/success?...)
 *             schema:
 *               type: string
 *               example: "myapp://payment/success?orderId=123&orderCode=456&status=PAID&success=true"
 *       302 (Error):
 *         description: Redirects to mobile app error deep link
 *         headers:
 *           Location:
 *             description: Error deep link URL (myapp://payment/error?...)
 *             schema:
 *               type: string
 *               example: "myapp://payment/error?error=Payment%20failed&success=false"
 */
router.get('/payment/success', async (req, res) => {
    try {
        console.log('📥 Payment Success Callback:', {
            query: req.query,
            headers: {
                'user-agent': req.headers['user-agent'],
                'referer': req.headers['referer']
            },
            timestamp: new Date().toISOString()
        })
        
        const result = await paymentService.handlePaymentReturn(req.query)
        
        console.log('✅ Payment Result:', result)

        const deepLinkUrl = `myapp://payment/success?` + 
            `orderId=${result.orderId}&` +
            `orderCode=${result.orderCode}&` +
            `status=${result.status}&` +
            `paymentCode=${req.query.orderCode}&` +
            `transactionId=${req.query.id}&` +
            `success=true&` +
            `message=${encodeURIComponent(result.message)}`
        
        console.log('🔗 Redirecting to:', deepLinkUrl)
        
        return res.redirect(deepLinkUrl)
    } catch (error) {
        console.error('❌ Payment Success Error:', {
            error: error.message,
            stack: error.stack,
            query: req.query,
            timestamp: new Date().toISOString()
        })
        
        const errorDeepLink = `myapp://payment/error?` +
            `error=${encodeURIComponent(error.message)}&` +
            `orderCode=${req.query.orderCode || ''}&` +
            `success=false`
        
        console.log('🔗 Error redirect to:', errorDeepLink)
        
        return res.redirect(errorDeepLink)
    }
})

/**
 * @swagger
 * /api/payments/payment/cancel:
 *   get:
 *     summary: Handle cancelled payment return from PayOS (Mobile Deep Link)
 *     description: Automatically redirects to mobile app deep link with cancellation result
 *     tags: [Payments]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Payment result code from PayOS
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         description: Transaction ID from PayOS
 *       - in: query
 *         name: orderCode
 *         schema:
 *           type: string
 *         description: Order code from PayOS
 *       - in: query
 *         name: cancel
 *         schema:
 *           type: string
 *         description: Cancel flag from PayOS
 *       - in: query
 *         name: amount
 *         schema:
 *           type: string
 *         description: Payment amount from PayOS
 *     responses:
 *       302:
 *         description: Redirects to mobile app deep link
 *         headers:
 *           Location:
 *             description: Deep link URL (myapp://payment/cancel?...)
 *             schema:
 *               type: string
 *               example: "myapp://payment/cancel?orderId=123&orderCode=456&status=CANCELLED&cancelled=true"
 *       302 (Error):
 *         description: Redirects to mobile app error deep link
 *         headers:
 *           Location:
 *             description: Error deep link URL (myapp://payment/error?...)
 *             schema:
 *               type: string
 *               example: "myapp://payment/error?error=Processing%20failed&cancelled=true"
 */
router.get('/payment/cancel', async (req, res) => {
    try {
        console.log('📥 Payment Cancel Callback:', {
            query: req.query,
            headers: {
                'user-agent': req.headers['user-agent'],
                'referer': req.headers['referer']
            },
            timestamp: new Date().toISOString()
        })
        
        const { orderCode } = req.query;
        
        // Tự động cập nhật order và transaction status khi user cancel trên PayOS
        if (orderCode) {
            try {
                await paymentService.cancelPaymentLink(orderCode, 'User cancelled on PayOS');
                console.log('✅ Order and transaction cancelled successfully:', orderCode);
            } catch (cancelError) {
                console.error('❌ Error cancelling payment:', cancelError.message);
                // Continue with redirect even if cancel fails
            }
        }
        
        const result = await paymentService.handlePaymentReturn(req.query)

        console.log('✅ Cancel Result:', result)

        // For mobile apps, redirect to deep link with parameters
        const deepLinkUrl = `myapp://payment/cancel?` + 
            `orderId=${result.orderId}&` +
            `orderCode=${result.orderCode}&` +
            `status=CANCELLED&` +
            `cancelled=true&` +
            `success=false&` +
            `message=${encodeURIComponent('Payment was cancelled')}`
        
        console.log('🔗 Cancel redirect to:', deepLinkUrl)
        
        return res.redirect(deepLinkUrl)
    } catch (error) {
        console.error('❌ Payment Cancel Error:', {
            error: error.message,
            stack: error.stack,
            query: req.query,
            timestamp: new Date().toISOString()
        })
        
        // For mobile, redirect to error deep link
        const errorDeepLink = `myapp://payment/error?` +
            `error=${encodeURIComponent(error.message)}&` +
            `orderCode=${req.query.orderCode || ''}&` +
            `cancelled=true&` +
            `success=false`
        
        console.log('🔗 Error redirect to:', errorDeepLink)
        
        return res.redirect(errorDeepLink)
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

module.exports = router
