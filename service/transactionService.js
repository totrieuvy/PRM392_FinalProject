const Transaction = require('../models/Transaction')
const Account = require('../models/Account')

class TransactionService {
    async getTransactions(filters = {}, userId = null) {
        const query = {}

        if (userId) {
            query.$or = [{ fromAccount: userId }, { toAccount: userId }]
        }

        if (filters.status) {
            query.transactionStatus = filters.status
        }

        if (filters.startDate || filters.endDate) {
            query.transactionDate = {}
            if (filters.startDate) {
                query.transactionDate.$gte = new Date(filters.startDate)
            }
            if (filters.endDate) {
                query.transactionDate.$lte = new Date(filters.endDate)
            }
        }

        // Filter by transaction type (incoming/outgoing)
        if (filters.type && userId) {
            if (filters.type === 'incoming') {
                query.toAccount = userId
                delete query.$or
            } else if (filters.type === 'outgoing') {
                query.fromAccount = userId
                delete query.$or
            }
        }

        const transactions = await Transaction.find(query)
            .populate('fromAccount', 'fullName email')
            .populate('toAccount', 'fullName email')
            .sort({ transactionDate: -1 })

        return transactions
    }

    async getTransactionById(transactionId) {
        const transaction = await Transaction.findById(transactionId)
            .populate('fromAccount', 'fullName email phone')
            .populate('toAccount', 'fullName email phone')

        if (!transaction) {
            throw new Error('Transaction not found')
        }

        return transaction
    }

    async createTransaction(transactionData) {
        const {
            fromAccount,
            toAccount,
            transactionStatus = 'pending',
        } = transactionData

        const fromAccountExists = await Account.findById(fromAccount)
        if (!fromAccountExists) {
            throw new Error('From account not found')
        }

        const toAccountExists = await Account.findById(toAccount)
        if (!toAccountExists) {
            throw new Error('To account not found')
        }

        const transaction = new Transaction({
            fromAccount,
            toAccount,
            transactionStatus,
            transactionDate: new Date(),
        })

        const savedTransaction = await transaction.save()

        return await this.getTransactionById(savedTransaction._id)
    }

    async updateTransactionStatus(transactionId, status) {
        const validStatuses = ['pending', 'completed', 'failed', 'cancelled']
        if (!validStatuses.includes(status)) {
            throw new Error('Invalid transaction status')
        }

        const transaction = await Transaction.findById(transactionId)
        if (!transaction) {
            throw new Error('Transaction not found')
        }

        const updatedTransaction = await Transaction.findByIdAndUpdate(
            transactionId,
            { transactionStatus: status },
            { new: true }
        )
            .populate('fromAccount', 'fullName email')
            .populate('toAccount', 'fullName email')

        return updatedTransaction
    }

    async getUserTransactions(userId, filters = {}) {
        return await this.getTransactions(filters, userId)
    }

    async getTransactionStats(userId = null) {
        const matchStage = userId
            ? {
                  $match: {
                      $or: [{ fromAccount: userId }, { toAccount: userId }],
                  },
              }
            : { $match: {} }

        const stats = await Transaction.aggregate([
            matchStage,
            {
                $group: {
                    _id: '$transactionStatus',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$amount' },
                },
            },
        ])

        const totalTransactions = await Transaction.countDocuments(
            userId
                ? {
                      $or: [{ fromAccount: userId }, { toAccount: userId }],
                  }
                : {}
        )

        return {
            total: totalTransactions,
            byStatus: stats.reduce((acc, stat) => {
                acc[stat._id] = {
                    count: stat.count,
                    totalAmount: stat.totalAmount || 0,
                }
                return acc
            }, {}),
        }
    }

    async getRecentTransactions(userId, limit = 10) {
        const query = {
            $or: [{ fromAccount: userId }, { toAccount: userId }],
        }

        const transactions = await Transaction.find(query)
            .populate('fromAccount', 'fullName email')
            .populate('toAccount', 'fullName email')
            .sort({ transactionDate: -1 })
            .limit(limit)

        return transactions
    }

    async searchTransactions(searchTerm, userId = null) {
        const pipeline = []

        // Match stage for user filtering
        if (userId) {
            pipeline.push({
                $match: {
                    $or: [{ fromAccount: userId }, { toAccount: userId }],
                },
            })
        }

        // Populate accounts
        pipeline.push(
            {
                $lookup: {
                    from: 'accounts',
                    localField: 'fromAccount',
                    foreignField: '_id',
                    as: 'fromAccountData',
                },
            },
            {
                $lookup: {
                    from: 'accounts',
                    localField: 'toAccount',
                    foreignField: '_id',
                    as: 'toAccountData',
                },
            }
        )

        // Match search term
        pipeline.push({
            $match: {
                $or: [
                    {
                        transactionStatus: {
                            $regex: searchTerm,
                            $options: 'i',
                        },
                    },
                    {
                        'fromAccountData.fullName': {
                            $regex: searchTerm,
                            $options: 'i',
                        },
                    },
                    {
                        'fromAccountData.email': {
                            $regex: searchTerm,
                            $options: 'i',
                        },
                    },
                    {
                        'toAccountData.fullName': {
                            $regex: searchTerm,
                            $options: 'i',
                        },
                    },
                    {
                        'toAccountData.email': {
                            $regex: searchTerm,
                            $options: 'i',
                        },
                    },
                ],
            },
        })

        // Sort by date
        pipeline.push({
            $sort: { transactionDate: -1 },
        })

        const transactions = await Transaction.aggregate(pipeline)
        return transactions
    }
}

module.exports = new TransactionService()
