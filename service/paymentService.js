const PayOS = require('@payos/node')
const Order = require('../models/Order')
const Transaction = require('../models/Transaction')
const orderService = require('./orderService')
const OrderItem = require('../models/OrderItem')

class PaymentService {
    constructor() {
        this.payOS = new PayOS(
            process.env.PAYOS_CLIENT_ID,
            process.env.PAYOS_API_KEY,
            process.env.PAYOS_CHECKSUM_KEY
        )
    }

    async createPaymentLink(orderData) {
        const { orderId, returnUrl, cancelUrl } = orderData

        if (!orderId) {
            throw new Error('Order ID is required')
        }

        const order = await Order.findById(orderId).populate(
            'accountId',
            'fullName email phone'
        )

        if (!order) {
            throw new Error('Order not found')
        }

        if (order.status !== 'pending') {
            throw new Error(`Order is not in pending status. Current status: ${order.status}`)
        }

        if (order.paymentCode) {
            throw new Error('Payment link already exists for this order')
        }

        const orderCode = this.generateUniquePaymentCode()

        const orderItems = await OrderItem.find({ orderId }).populate(
            'flowerId',
            'name price'
        )

        if (!orderItems || orderItems.length === 0) {
            throw new Error('No order items found')
        }

        let calculatedTotal = 0
        const items = orderItems.map((item) => {
            if (!item.flowerId) {
                throw new Error('Invalid flower data in order items')
            }
            const itemTotal = parseFloat(item.actualPrice) * item.quantity
            calculatedTotal += itemTotal
            
            return {
                name: item.flowerId.name,
                quantity: item.quantity,
                price: Math.round(parseFloat(item.actualPrice) * 100), // Convert to cents
            }
        })

        const orderTotal = parseFloat(order.totalAmount)
        if (Math.abs(calculatedTotal - orderTotal) > 0.01) {
            console.warn(`Total amount mismatch: calculated=${calculatedTotal}, order=${orderTotal}`)
        }

        const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
        
        const paymentData = {
            orderCode: orderCode,
            amount: Math.round(orderTotal * 100),
            description: `#${order._id}`,
            items: items,
            returnUrl: returnUrl || `${baseUrl}/api/payments/payment/success`,
            cancelUrl: cancelUrl || `${baseUrl}/api/payments/payment/cancel`,
            buyerName: order.accountId.fullName || 'Customer',
            buyerEmail: order.accountId.email || '',
            buyerPhone: order.accountId.phone || '',
        }

        console.log('💳 Creating payment link:', {
            orderCode,
            orderId,
            amount: paymentData.amount,
            itemCount: items.length,
            returnUrl: paymentData.returnUrl,
            cancelUrl: paymentData.cancelUrl
        })

        const transaction = new Transaction({
            fromAccount: order.accountId._id,
            toAccount: process.env.SYSTEM_ACCOUNT_ID || '68590d9b8c57b1e5a983fc16', // Fallback system account
            amount: parseFloat(order.totalAmount),
            transactionStatus: 'pending',
            transactionDate: new Date(),
        })

        const savedTransaction = await transaction.save()

        await Order.findByIdAndUpdate(orderId, {
            transactionId: savedTransaction._id,
            paymentCode: orderCode.toString(),
        })

        try {
            const paymentLinkResponse = await this.payOS.createPaymentLink(
                paymentData
            )

            console.log('✅ PayOS response:', {
                paymentLinkId: paymentLinkResponse.paymentLinkId,
                checkoutUrl: paymentLinkResponse.checkoutUrl ? 'Available' : 'Missing',
                qrCode: paymentLinkResponse.qrCode ? 'Available' : 'Missing'
            })

            return {
                checkoutUrl: paymentLinkResponse.checkoutUrl,
                paymentCode: orderCode,
                transactionId: savedTransaction._id,
                orderId: orderId,
                amount: paymentData.amount / 100,
                qrCode: paymentLinkResponse.qrCode,
                paymentLinkId: paymentLinkResponse.paymentLinkId,
                orderInfo: {
                    customerName: order.accountId.fullName,
                    customerEmail: order.accountId.email,
                    itemCount: items.length,
                    description: paymentData.description
                }
            }
        } catch (error) {
            console.error('❌ PayOS createPaymentLink error:', error)
            
            // Rollback transaction on failure
            await Transaction.findByIdAndUpdate(savedTransaction._id, {
                transactionStatus: 'failed',
            })
            
            // Clear payment code from order
            await Order.findByIdAndUpdate(orderId, {
                $unset: { paymentCode: 1 }
            })
            
            throw new Error(`Payment link creation failed: ${error.message}`)
        }
    }

    async handlePaymentReturn(queryParams) {
        const { code, id, cancel, status, orderCode } = queryParams

        console.log('📥 Payment return params:', {
            code,
            id,
            cancel,
            status,
            orderCode,
            timestamp: new Date().toISOString()
        })

        try {
            if (!orderCode) {
                throw new Error('Order code is missing from payment return')
            }

            const order = await Order.findOne({
                paymentCode: orderCode.toString(),
            }).populate('accountId', 'fullName email')

            if (!order) {
                throw new Error(`Order not found for payment code: ${orderCode}`)
            }

            let result = {
                success: false,
                message: 'Payment failed',
                orderCode: orderCode,
                orderId: order._id,
                status: 'FAILED'
            }

            // Handle successful payment
            if (code === '00' && status === 'PAID') {
                const transaction = await Transaction.findById(
                    order.transactionId
                )
                
                if (!transaction) {
                    throw new Error('Transaction not found')
                }

                // Prevent double processing
                if (transaction.transactionStatus === 'completed') {
                    console.log('⚠️ Payment already processed:', orderCode)
                    result = {
                        success: true,
                        message: 'Payment already completed',
                        orderCode: orderCode,
                        orderId: order._id,
                        status: 'PAID',
                    }
                } else {
                    await Transaction.findByIdAndUpdate(transaction._id, {
                        transactionStatus: 'completed',
                    })

                    await orderService.updatePaymentStatus(
                        order._id,
                        transaction._id
                    )

                    console.log('✅ Payment completed successfully:', orderCode)
                    
                    result = {
                        success: true,
                        message: 'Payment completed successfully',
                        orderCode: orderCode,
                        orderId: order._id,
                        status: 'PAID',
                    }
                }
            } 
            // Handle cancelled payment
            else if (cancel === 'true' || status === 'CANCELLED') {
                const transaction = await Transaction.findById(
                    order.transactionId
                )
                
                if (transaction && transaction.transactionStatus !== 'cancelled') {
                    await Transaction.findByIdAndUpdate(transaction._id, {
                        transactionStatus: 'cancelled',
                    })
                }

                console.log('❌ Payment cancelled:', orderCode)

                result = {
                    success: false,
                    message: 'Payment was cancelled by user',
                    orderCode: orderCode,
                    orderId: order._id,
                    status: 'CANCELLED',
                }
            }
            // Handle failed payment
            else {
                const transaction = await Transaction.findById(
                    order.transactionId
                )
                
                if (transaction && transaction.transactionStatus === 'pending') {
                    await Transaction.findByIdAndUpdate(transaction._id, {
                        transactionStatus: 'failed',
                    })
                }

                console.log('❌ Payment failed:', { code, status, orderCode })

                result = {
                    success: false,
                    message: `Payment failed with code: ${code}`,
                    orderCode: orderCode,
                    orderId: order._id,
                    status: 'FAILED',
                }
            }

            return result
        } catch (error) {
            console.error('💥 Payment return processing error:', error)
            throw error
        }
    }

    async handlePaymentWebhook(webhookData) {
        try {
            const verifyResult =
                this.payOS.verifyPaymentWebhookData(webhookData)

            if (!verifyResult) {
                throw new Error('Invalid webhook signature')
            }

            const { orderCode, status, amount, description } = webhookData

            const order = await Order.findOne({
                paymentCode: orderCode.toString(),
            })

            if (!order) {
                throw new Error('Order not found for payment code')
            }

            const transaction = await Transaction.findById(order.transactionId)
            if (transaction) {
                let transactionStatus = 'failed'

                switch (status) {
                    case 'PAID':
                        transactionStatus = 'completed'
                        await orderService.updatePaymentStatus(
                            order._id,
                            transaction._id
                        )
                        break
                    case 'CANCELLED':
                        transactionStatus = 'cancelled'
                        break
                    default:
                        transactionStatus = 'failed'
                }

                await Transaction.findByIdAndUpdate(transaction._id, {
                    transactionStatus,
                })
            }

            return {
                success: true,
                message: 'Webhook processed successfully',
                orderCode,
                status: transaction.transactionStatus,
            }
        } catch (error) {
            console.error('Webhook processing error:', error)
            throw error
        }
    }

    async getPaymentLinkInfo(paymentCode) {
        try {
            const paymentInfo = await this.payOS.getPaymentLinkInformation(
                paymentCode
            )
            return paymentInfo
        } catch (error) {
            throw new Error(`Failed to get payment info: ${error.message}`)
        }
    }

    async cancelPaymentLink(paymentCode, reason = 'Customer request') {
        try {
            const cancelResult = await this.payOS.cancelPaymentLink(
                paymentCode,
                reason
            )

            // Update transaction status
            const order = await Order.findOne({
                paymentCode: paymentCode.toString(),
            })

            if (order && order.transactionId) {
                await Transaction.findByIdAndUpdate(order.transactionId, {
                    transactionStatus: 'cancelled',
                })
            }

            return cancelResult
        } catch (error) {
            throw new Error(`Failed to cancel payment: ${error.message}`)
        }
    }

    generateUniquePaymentCode() {
        const timestamp = Date.now().toString()
        const randomNum = Math.floor(Math.random() * 1000)
        return Number(
            timestamp.slice(-6) + randomNum.toString().padStart(3, '0')
        )
    }
}

module.exports = new PaymentService()
