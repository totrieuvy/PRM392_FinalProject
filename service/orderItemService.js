const OrderItem = require('../models/OrderItem')
const Flower = require('../models/Flower')
const Order = require('../models/Order')

class OrderItemService {
    async createOrderItem(orderItemData) {
        const { flowerId, quantity, orderId } = orderItemData

        const flower = await Flower.findById(flowerId)
        if (!flower) {
            throw new Error('Flower not found')
        }

        const order = await Order.findById(orderId)
        if (!order) {
            throw new Error('Order not found')
        }

        if (flower.stock < quantity) {
            throw new Error(
                `Not enough stock. Available: ${flower.stock}, Requested: ${quantity}`
            )
        }

        const orderItem = new OrderItem({
            flowerId,
            actualPrice: flower.price,
            quantity,
            orderId,
        })

        const savedOrderItem = await orderItem.save()

        await Flower.findByIdAndUpdate(flowerId, {
            $inc: { stock: -quantity },
        })

        return await OrderItem.findById(savedOrderItem._id)
            .populate('flowerId', 'name image description price')
            .populate('orderId', 'orderAt totalAmount')
    }

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
        const orderItem = await OrderItem.findById(orderItemId)
        if (!orderItem) {
            throw new Error('Order item not found')
        }

        const order = await Order.findById(orderItem.orderId)

        if (order.status !== 'pending') {
            throw new Error(
                'Cannot modify order item. Order is no longer pending'
            )
        }

        const updatedOrderItem = await OrderItem.findByIdAndUpdate(
            orderItemId,
            updateData,
            { new: true }
        ).populate('flowerId', 'name image description price')

        return updatedOrderItem
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
