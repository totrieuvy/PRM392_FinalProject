const mongoose = require('mongoose')

const roleSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            enum: ['admin', 'user', 'seller', 'shipper'],
        },
        description: {
            type: String,
            trim: true,
        },
        permissions: [
            {
                type: String,
                trim: true,
            },
        ],
    },
    {
        timestamps: true,
    }
)

module.exports = mongoose.model('Role', roleSchema)
