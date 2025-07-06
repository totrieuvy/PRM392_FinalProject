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

        const order = await Order.findById(orderId).populate(
            'accountId',
            'fullName email phone'
        )

        if (!order) {
            throw new Error('Order not found')
        }

        if (order.status !== 'pending') {
            throw new Error('Order is not in pending status')
        }

        const orderCode = this.generateUniquePaymentCode()

        const orderItems = await OrderItem.find({ orderId }).populate(
            'flowerId',
            'name price'
        )

        const items = orderItems.map((item) => ({
            name: item.flowerId.name,
            quantity: item.quantity,
            price: Math.round(parseFloat(item.actualPrice) * 100),
        }))

        const paymentData = {
            orderCode: orderCode,
            amount: Math.round(parseFloat(order.totalAmount) * 100),
            description: `#${order._id}`,
            items: items,
            returnUrl:
                returnUrl || `${process.env.FRONTEND_URL}/payment/success`,
            cancelUrl:
                cancelUrl || `${process.env.FRONTEND_URL}/payment/cancel`,
            buyerName: order.accountId.fullName,
            buyerEmail: order.accountId.email,
            buyerPhone: order.accountId.phone,
        }

        const transaction = new Transaction({
            fromAccount: order.accountId._id,
            toAccount: process.env.SYSTEM_ACCOUNT_ID,
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
            }
        } catch (error) {
            await Transaction.findByIdAndUpdate(savedTransaction._id, {
                transactionStatus: 'failed',
            })
            throw new Error(`Payment link creation failed: ${error.message}`)
        }
    }

    async handlePaymentReturn(queryParams) {
        const { code, id, cancel, status, orderCode } = queryParams

        try {
            const order = await Order.findOne({
                paymentCode: orderCode.toString(),
            })

            if (!order) {
                throw new Error('Order not found for payment code')
            }

            let result = {
                success: false,
                message: 'Payment failed',
                orderCode: orderCode,
                orderId: order._id,
            }

            if (code === '00' && status === 'PAID') {
                const transaction = await Transaction.findById(
                    order.transactionId
                )
                if (transaction) {
                    await Transaction.findByIdAndUpdate(transaction._id, {
                        transactionStatus: 'completed',
                    })

                    await orderService.updatePaymentStatus(
                        order._id,
                        transaction._id
                    )

                    result = {
                        success: true,
                        message: 'Payment successful',
                        orderCode: orderCode,
                        orderId: order._id,
                        status: 'PAID',
                    }
                }
            } else if (cancel === 'true') {
                const transaction = await Transaction.findById(
                    order.transactionId
                )
                if (transaction) {
                    await Transaction.findByIdAndUpdate(transaction._id, {
                        transactionStatus: 'cancelled',
                    })
                }

                result = {
                    success: false,
                    message: 'Payment cancelled',
                    orderCode: orderCode,
                    orderId: order._id,
                    status: 'CANCELLED',
                }
            }

            return result
        } catch (error) {
            console.error('Payment return processing error:', error)
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
