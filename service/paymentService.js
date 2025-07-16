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

        const order = await Order.findById(orderId)
            .populate('accountId', 'fullName email phone')
            .read('primary')

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

        const orderItems = await OrderItem.find({ orderId })
            .populate('flowerId', 'name price')
            .read('primary')

        if (!orderItems || orderItems.length === 0) {
            throw new Error('No order items found for this order. Please ensure the order was created properly.')
        }

        let calculatedTotal = 0
        const items = orderItems.map((item, index) => {

            if (!item.flowerId) {
                throw new Error(`Invalid flower data in order item at index ${index}. Flower not found or not populated.`)
            }
            if (!item.flowerId.name) {
                throw new Error(`Flower name is missing for item at index ${index}`)
            }
            if (!item.actualPrice || isNaN(parseFloat(item.actualPrice))) {
                throw new Error(`Invalid price for item at index ${index}: ${item.actualPrice}`)
            }
            if (!item.quantity || isNaN(parseInt(item.quantity))) {
                throw new Error(`Invalid quantity for item at index ${index}: ${item.quantity}`)
            }

            const itemTotal = parseFloat(item.actualPrice) * item.quantity
            calculatedTotal += itemTotal
            
            return {
                name: item.flowerId.name,
                quantity: item.quantity,
                price: Math.round(parseFloat(item.actualPrice)),
            }
        })

        const orderTotal = parseFloat(order.totalAmount)
        if (Math.abs(calculatedTotal - orderTotal) > 0.01) {
            console.warn(`Total amount mismatch: calculated=${calculatedTotal}, order=${orderTotal}`)
        }

        const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
        
        const paymentData = {
            orderCode: orderCode,
            amount: Math.round(orderTotal),
            description: `#${order._id}`,
            items: items,
            returnUrl: returnUrl || `${baseUrl}/api/payments/payment/success`,
            cancelUrl: cancelUrl || `${baseUrl}/api/payments/payment/cancel`,
            buyerName: order.accountId.fullName || 'Customer',
            buyerEmail: order.accountId.email || '',
            buyerPhone: order.accountId.phone || '',
        }

        const transaction = new Transaction({
            fromAccount: order.accountId._id,
            toAccount: process.env.SYSTEM_ACCOUNT_ID || '68590d9b8c57b1e5a983fc16',
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
            
            await Transaction.findByIdAndUpdate(savedTransaction._id, {
                transactionStatus: 'failed',
            })
            
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
            .read('primary')

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

    async getPaymentLinkInfo(paymentCode) {
        try {
            const paymentInfo = await this.payOS.getPaymentLinkInformation(
                paymentCode
            )

            const order = await Order.findOne({
                paymentCode: paymentCode.toString(),
            }).populate('accountId', 'fullName email')
            .read('primary')

            return {
                success: true,
                message: 'Payment information retrieved successfully',
                data: paymentInfo,
                orderInfo: order ? {
                    orderId: order._id,
                    orderStatus: order.status,
                    customerName: order.accountId?.fullName,
                    totalAmount: order.totalAmount,
                    orderDate: order.orderAt
                } : null
            }
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

            const order = await Order.findOne({
                paymentCode: paymentCode.toString(),
            }).read('primary')

            if (order) {
                if (order.transactionId) {
                    await Transaction.findByIdAndUpdate(order.transactionId, {
                        transactionStatus: 'cancelled',
                    })
                }

                await Order.findByIdAndUpdate(order._id, {
                    status: 'cancelled'
                })
            }

            return {
                success: true,
                message: 'Payment cancelled successfully',
                data: cancelResult,
                orderInfo: order ? {
                    orderId: order._id,
                    orderStatus: 'cancelled'
                } : null
            }
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
