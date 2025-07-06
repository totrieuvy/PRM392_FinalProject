const mongoose = require('mongoose')

const orderItemSchema = new mongoose.Schema(
    {
        flowerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Flower',
            required: true,
        },
        actualPrice: {
            type: mongoose.Schema.Types.Decimal128,
            required: true,
            min: 0,
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
        },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
            required: true,
        },
    },
    {
        timestamps: true,
    }
)

module.exports = mongoose.model('OrderItem', orderItemSchema)
