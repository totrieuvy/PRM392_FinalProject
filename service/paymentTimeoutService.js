const cron = require('node-cron')
const Order = require('../models/Order')
const Transaction = require('../models/Transaction')

class PaymentTimeoutService {
    constructor() {
        this.PAYMENT_TIMEOUT_MINUTES = 10
        this.isRunning = false
    }

    startPaymentTimeoutChecker() {
        if (this.isRunning) {
            console.log('Payment timeout checker is already running')
            return
        }

        console.log(`Payment timeout checker started - auto-cancel after ${this.PAYMENT_TIMEOUT_MINUTES} minutes`)
        
        cron.schedule('* * * * *', async () => {
            try {
                await this.checkAndCancelExpiredPayments()
            } catch (error) {
                console.error('Error in payment timeout checker:', error.message)
            }
        })

        this.isRunning = true
    }

    async checkAndCancelExpiredPayments() {
        try {
            const timeoutThreshold = new Date(Date.now() - this.PAYMENT_TIMEOUT_MINUTES * 60 * 1000)

            const expiredOrders = await Order.find({
                status: 'pending',
                paymentCode: { $exists: true, $ne: null },
                orderAt: { $lt: timeoutThreshold }
            }).read('primary')

            if (expiredOrders.length === 0) {
                return
            }

            console.log(`Auto-cancelling ${expiredOrders.length} expired payment order(s)`)
            for (const order of expiredOrders) {
                await this.cancelExpiredOrder(order)
            }

        } catch (error) {
            console.error('Error checking expired payments:', error.message)
        }
    }

    async cancelExpiredOrder(order) {
        try {
            await Order.findByIdAndUpdate(order._id, {
                status: 'cancelled',
            })

            if (order.transactionId) {
                await Transaction.findByIdAndUpdate(order.transactionId, {
                    transactionStatus: 'cancelled',
                    updatedAt: new Date()
                })
            }

            console.log(`Cancelled order ${order._id} due to payment timeout`)

        } catch (error) {
            console.error(`Error cancelling order ${order._id}:`, error.message)
        }
    }
}

module.exports = new PaymentTimeoutService()
