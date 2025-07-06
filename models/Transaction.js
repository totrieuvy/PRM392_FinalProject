const mongoose = require('mongoose')

const transactionSchema = new mongoose.Schema(
    {
        fromAccount: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            required: true,
        },
        toAccount: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            required: true,
        },
        transactionStatus: {
            type: String,
            required: true,
            enum: ['pending', 'completed', 'failed', 'cancelled'],
            trim: true,
        },
        transactionDate: {
            type: Date,
            default: Date.now,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        paymentCode: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
)

module.exports = mongoose.model('Transaction', transactionSchema)
