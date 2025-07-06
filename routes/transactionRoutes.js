const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const transactionService = require('../service/transactionService');
const verifyToken = require('../middlewares/verifyToken');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Transactions
 *   description: Transaction management and history endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Transaction:
 *       type: object
 *       required:
 *         - fromAccount
 *         - toAccount
 *         - amount
 *       properties:
 *         fromAccount:
 *           type: string
 *           description: Source account ID
 *         toAccount:
 *           type: string
 *           description: Destination account ID
 *         amount:
 *           type: number
 *           description: Transaction amount
 *         transactionStatus:
 *           type: string
 *           enum: [pending, completed, failed, cancelled]
 *           default: pending
 *           description: Transaction status
 *       example:
 *         fromAccount: "60f7b1234567890123456789"
 *         toAccount: "60f7b1234567890123456790"
 *         amount: 150.50
 *         transactionStatus: "pending"
 *     TransactionResponse:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         fromAccount:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             fullName:
 *               type: string
 *             email:
 *               type: string
 *         toAccount:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             fullName:
 *               type: string
 *             email:
 *               type: string
 *         amount:
 *           type: number
 *         transactionStatus:
 *           type: string
 *           enum: [pending, completed, failed, cancelled]
 *         transactionDate:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

/**
 * @swagger
 * /api/transactions:
 *   get:
 *     summary: Get transaction history with filters
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, failed, cancelled]
 *         description: Filter by transaction status
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [incoming, outgoing]
 *         description: Transaction type filter
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter (ISO format)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter (ISO format)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for transactions
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Limit number of results
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TransactionResponse'
 *                 count:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/',
  verifyToken,
  [
    query('status').optional().isIn(['pending', 'completed', 'failed', 'cancelled']).withMessage('Invalid transaction status'),
    query('type').optional().isIn(['incoming', 'outgoing']).withMessage('Transaction type must be incoming or outgoing'),
    query('startDate').optional().isISO8601().withMessage('Start date must be valid ISO date'),
    query('endDate').optional().isISO8601().withMessage('End date must be valid ISO date'),
    query('search').optional().isString().withMessage('Search term must be a string'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { status, type, startDate, endDate, search, limit } = req.query;
      const filters = { status, type, startDate, endDate };
      let transactions;
      
      if (search) {
        // Search transactions
        transactions = await transactionService.searchTransactions(
          search, 
          req.userRole === 'admin' ? null : req.userId
        );
      } else {
        // Get filtered transactions
        transactions = await transactionService.getTransactions(
          filters, 
          req.userRole === 'admin' ? null : req.userId
        );
      }
      
      // Apply limit if specified
      if (limit) {
        transactions = transactions.slice(0, parseInt(limit));
      }
      
      res.json({
        success: true,
        message: 'Transactions retrieved successfully',
        data: transactions,
        count: transactions.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/transactions/{id}:
 *   get:
 *     summary: Get transaction details by ID
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID
 *     responses:
 *       200:
 *         description: Transaction details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/TransactionResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Permission denied
 *       404:
 *         description: Transaction not found
 *       422:
 *         description: Validation error
 */
router.get('/:id',
  verifyToken,
  [
    param('id').isMongoId().withMessage('Valid transaction ID is required')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const transaction = await transactionService.getTransactionById(req.params.id);
      
      // Check if user has permission to view this transaction
      const isFromAccount = transaction.fromAccount._id.toString() === req.userId;
      const isToAccount = transaction.toAccount._id.toString() === req.userId;
      const isAdmin = req.userRole === 'admin';
      
      if (!isFromAccount && !isToAccount && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied'
        });
      }
      
      res.json({
        success: true,
        message: 'Transaction details retrieved successfully',
        data: transaction
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/transactions:
 *   post:
 *     summary: Create new transaction (admin only)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Transaction'
 *     responses:
 *       201:
 *         description: Transaction created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/TransactionResponse'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Permission denied (admin only)
 *       422:
 *         description: Validation error
 */
router.post('/',
  verifyToken,
  [
    body('fromAccount').isMongoId().withMessage('Valid from account ID is required'),
    body('toAccount').isMongoId().withMessage('Valid to account ID is required'),
    body('transactionStatus').optional().isIn(['pending', 'completed', 'failed', 'cancelled']).withMessage('Invalid transaction status')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Only admin can create transactions manually
      if (req.userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Permission denied. Only admin can create transactions'
        });
      }
      
      const transaction = await transactionService.createTransaction(req.body);
      res.status(201).json({
        success: true,
        message: 'Transaction created successfully',
        data: transaction
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/transactions/{id}/status:
 *   patch:
 *     summary: Update transaction status (admin only)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, completed, failed, cancelled]
 *                 description: New transaction status
 *           example:
 *             status: "completed"
 *     responses:
 *       200:
 *         description: Transaction status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/TransactionResponse'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Permission denied (admin only)
 *       422:
 *         description: Validation error
 */
router.patch('/:id/status',
  verifyToken,
  [
    param('id').isMongoId().withMessage('Valid transaction ID is required'),
    body('status').isIn(['pending', 'completed', 'failed', 'cancelled']).withMessage('Invalid transaction status')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Only admin can update transaction status
      if (req.userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Permission denied. Only admin can update transaction status'
        });
      }
      
      const { status } = req.body;
      const transaction = await transactionService.updateTransactionStatus(req.params.id, status);
      
      res.json({
        success: true,
        message: 'Transaction status updated successfully',
        data: transaction
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/transactions/stats:
 *   get:
 *     summary: Get transaction statistics
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Transaction statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalTransactions:
 *                       type: integer
 *                     totalAmount:
 *                       type: number
 *                     statusBreakdown:
 *                       type: object
 *                     monthlyStats:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/stats',
  verifyToken,
  async (req, res) => {
    try {
      const stats = await transactionService.getTransactionStats(
        req.userRole === 'admin' ? null : req.userId
      );
      
      res.json({
        success: true,
        message: 'Transaction statistics retrieved successfully',
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/transactions/recent:
 *   get:
 *     summary: Get recent transactions
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Limit number of recent transactions
 *     responses:
 *       200:
 *         description: Recent transactions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TransactionResponse'
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.get('/recent',
  verifyToken,
  [
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 10;
      
      const transactions = await transactionService.getRecentTransactions(req.userId, limit);
      
      res.json({
        success: true,
        message: 'Recent transactions retrieved successfully',
        data: transactions
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

module.exports = router;