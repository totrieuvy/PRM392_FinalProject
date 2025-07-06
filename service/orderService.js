const Order = require('../models/Order')
const OrderItem = require('../models/OrderItem')
const Flower = require('../models/Flower')
const Account = require('../models/Account')
const mongoose = require('mongoose')

class OrderService {
    async createOrder(orderData, userId) {
        const session = await mongoose.startSession()
        session.startTransaction()

        try {
            const { items, addressShip, shippingFee = 0 } = orderData

            let totalAmount = 0
            const orderItems = []

            for (const item of items) {
                const flower = await Flower.findById(item.flowerId).session(
                    session
                )
                if (!flower) {
                    throw new Error(`Flower with ID ${item.flowerId} not found`)
                }

                if (flower.stock < item.quantity) {
                    throw new Error(
                        `Not enough stock for flower ${flower.name}. Available: ${flower.stock}, Requested: ${item.quantity}`
                    )
                }

                const itemTotal = flower.price * item.quantity
                totalAmount += itemTotal

                orderItems.push({
                    flowerId: item.flowerId,
                    actualPrice: flower.price,
                    quantity: item.quantity,
                })

                await Flower.findByIdAndUpdate(
                    item.flowerId,
                    { $inc: { stock: -item.quantity } },
                    { session }
                )
            }

            const order = new Order({
                accountId: userId,
                totalAmount: totalAmount + shippingFee,
                shippingFee,
                status: 'pending',
                addressShip,
                orderAt: new Date(),
            })

            const savedOrder = await order.save({ session })

            const orderItemsWithOrderId = orderItems.map((item) => ({
                ...item,
                orderId: savedOrder._id,
            }))

            await OrderItem.insertMany(orderItemsWithOrderId, { session })

            await session.commitTransaction()

            return await this.getOrderById(savedOrder._id)
        } catch (error) {
            await session.abortTransaction()
            throw error
        } finally {
            session.endSession()
        }
    }

    async getOrders(filters = {}, userId = null) {
        const query = {}

        if (userId) {
            query.accountId = userId
        }

        if (filters.status) {
            const validStatuses = [
                'pending',
                'paid',
                'confirmed',
                'shipped',
                'delivered',
                'cancelled',
            ]
            if (validStatuses.includes(filters.status)) {
                query.status = filters.status
            }
        }

        if (filters.startDate || filters.endDate) {
            query.orderAt = {}
            if (filters.startDate) {
                query.orderAt.$gte = new Date(filters.startDate)
            }
            if (filters.endDate) {
                query.orderAt.$lte = new Date(filters.endDate)
            }
        }

        const orders = await Order.find(query)
            .populate('accountId', 'fullName email phone')
            .populate('transactionId')
            .sort({ orderAt: -1 })

        return orders
    }

    async getOrderById(orderId) {
        const order = await Order.findById(orderId)
            .populate('accountId', 'fullName email phone')
            .populate('transactionId')

        if (!order) {
            throw new Error('Order not found')
        }

        const orderItems = await OrderItem.find({ orderId }).populate(
            'flowerId',
            'name image description'
        )

        return {
            ...order.toObject(),
            items: orderItems,
        }
    }

    async updateOrderStatus(orderId, statusName, userId) {
        const validStatuses = [
            'pending',
            'paid',
            'confirmed',
            'shipped',
            'delivered',
            'cancelled',
        ]
        if (!validStatuses.includes(statusName)) {
            throw new Error('Invalid order status')
        }

        const order = await Order.findById(orderId)
        if (!order) {
            throw new Error('Order not found')
        }

        const user = await Account.findById(userId)
        const isOwner = order.accountId.toString() === userId
        const isAdmin = user.role === 'admin'
        const isSeller = user.role === 'seller'

        if (!isOwner && !isAdmin && !isSeller) {
            throw new Error('Permission denied')
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { status: statusName },
            { new: true }
        )

        return updatedOrder
    }

    async updateProofOfDelivery(orderId, proofOfDelivery, userId) {
        const order = await Order.findById(orderId)
        if (!order) {
            throw new Error('Order not found')
        }

        const user = await Account.findById(userId)
        const isAdmin = user.role === 'admin'
        const isSeller = user.role === 'seller'

        if (!isAdmin && !isSeller) {
            throw new Error('Permission denied')
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { proofOfDelivery },
            { new: true }
        )

        return updatedOrder
    }

    async updatePaymentStatus(orderId, transactionId) {
        const order = await Order.findById(orderId)
        if (!order) {
            throw new Error('Order not found')
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            {
                paidAt: new Date(),
                status: 'paid',
                transactionId: transactionId,
            },
            { new: true }
        )

        return updatedOrder
    }

    async getUserOrders(userId) {
        return await this.getOrders({}, userId)
    }
}

module.exports = new OrderService()
