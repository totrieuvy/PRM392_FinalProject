const OrderItem = require('../models/OrderItem')
const Flower = require('../models/Flower')
const Order = require('../models/Order')

class OrderItemService {
    async getOrderItemsByOrderId(orderId) {
        const orderItems = await OrderItem.find({ orderId })
            .populate('flowerId', 'name image description price')
            .populate('orderId', 'orderAt totalAmount')

        return orderItems
    }

    async getOrderItemById(orderItemId) {
        const orderItem = await OrderItem.findById(orderItemId)
            .populate('flowerId', 'name image description price')
            .populate('orderId', 'orderAt totalAmount')

        if (!orderItem) {
            throw new Error('Order item not found')
        }

        return orderItem
    }

    async updateOrderItem(orderItemId, updateData) {
        const session = await require('mongoose').startSession()
        session.startTransaction()

        try {
            const orderItem = await OrderItem.findById(orderItemId).session(
                session
            )
            if (!orderItem) {
                throw new Error('Order item not found')
            }

            const order = await Order.findById(orderItem.orderId).session(
                session
            )
            if (order.status !== 'pending') {
                throw new Error(
                    'Cannot modify order item. Order is no longer pending'
                )
            }

            // Chỉ cho phép update quantity
            if (!updateData.quantity) {
                throw new Error('Only quantity updates are allowed')
            }

            const newQuantity = updateData.quantity
            const oldQuantity = orderItem.quantity
            const quantityDiff = newQuantity - oldQuantity

            // Validate flower và stock
            const flower = await Flower.findById(orderItem.flowerId).session(
                session
            )
            if (!flower) {
                throw new Error('Flower not found')
            }

            // Check stock nếu tăng quantity
            if (quantityDiff > 0 && flower.stock < quantityDiff) {
                throw new Error(
                    `Not enough stock. Available: ${flower.stock}, Additional needed: ${quantityDiff}`
                )
            }

            // Update flower stock
            await Flower.findByIdAndUpdate(
                orderItem.flowerId,
                { $inc: { stock: -quantityDiff } }, // Âm nếu tăng quantity, dương nếu giảm
                { session }
            )

            // Update order item
            const updatedOrderItem = await OrderItem.findByIdAndUpdate(
                orderItemId,
                { quantity: newQuantity },
                { new: true, session }
            ).populate('flowerId', 'name image description price')

            // Update order totalAmount
            const amountDiff = orderItem.actualPrice * quantityDiff
            await Order.findByIdAndUpdate(
                orderItem.orderId,
                { $inc: { totalAmount: amountDiff } },
                { session }
            )

            await session.commitTransaction()
            return updatedOrderItem
        } catch (error) {
            await session.abortTransaction()
            throw error
        } finally {
            session.endSession()
        }
    }

    async deleteOrderItem(orderItemId) {
        const orderItem = await OrderItem.findById(orderItemId)
        if (!orderItem) {
            throw new Error('Order item not found')
        }

        const order = await Order.findById(orderItem.orderId)

        if (order.status !== 'pending') {
            throw new Error(
                'Cannot delete order item. Order is no longer pending'
            )
        }

        await Flower.findByIdAndUpdate(orderItem.flowerId, {
            $inc: { stock: orderItem.quantity },
        })

        await OrderItem.findByIdAndDelete(orderItemId)

        return { message: 'Order item deleted successfully' }
    }
}

module.exports = new OrderItemService()
