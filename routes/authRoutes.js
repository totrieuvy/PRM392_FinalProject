const express = require('express')
const router = express.Router()
const authService = require('../service/authService')
const { body, validationResult } = require('express-validator')

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - phone
 *               - password
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: string
 *               email:
 *                 type: string
 *                 format: email
 *                 example: string
 *               phone:
 *                 type: string
 *                 example: string
 *               password:
 *                 type: string
 *                 example: string
 *     responses:
 *       201:
 *         description: User registered successfully, verification email sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Verification email sent
 *       400:
 *         description: Validation error or user already exists
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: Invalid email format
 */
router.post(
    '/register',
    [
        body('fullName').notEmpty().withMessage('Full name is required'),
        body('email').isEmail().withMessage('Invalid email format'),
        body('phone')
            .matches(/^\d{10}$/)
            .withMessage('Phone must be 10 digits'),
        body('password')
            .isLength({ min: 5 })
            .withMessage('Password must be at least 5 characters'),
    ],
    async (req, res, next) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).send(errors.array()[0].msg)
        }
        try {
            const { fullName, email, phone, password } = req.body
            await authService.register({ fullName, email, phone, password })
            res.status(201).json({ message: 'Verification email sent' })
        } catch (error) {
            return res.status(400).send(error.message)
        }
    }
)

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify OTP for user registration
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: string
 *               otp:
 *                 type: string
 *                 example: string
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Account verified successfully
 *       400:
 *         description: Invalid OTP or email
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: Invalid or expired OTP
 */
router.post(
    '/verify-otp',
    [
        body('email').isEmail().withMessage('Invalid email format'),
        body('otp').notEmpty().withMessage('OTP is required'),
    ],
    async (req, res, next) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).send(errors.array()[0].msg)
        }
        try {
            const { email, otp } = req.body
            await authService.verifyOtp(email, otp)
            res.json({ message: 'Account verified successfully' })
        } catch (error) {
            return res.status(400).send(error.message)
        }
    }
)

/**
 * @swagger
 * /api/auth/resend-otp:
 *   post:
 *     summary: Resend OTP for user registration
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: string
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: New OTP sent
 *       400:
 *         description: Invalid email or account already verified
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: Account not found
 */
router.post(
    '/resend-otp',
    [body('email').isEmail().withMessage('Invalid email format')],
    async (req, res, next) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).send(errors.array()[0].msg)
        }
        try {
            const { email } = req.body
            await authService.resendOtp(email)
            res.json({ message: 'New OTP sent' })
        } catch (error) {
            return res.status(400).send(error.message)
        }
    }
)

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: string
 *               password:
 *                 type: string
 *                 example: string
 *     responses:
 *       200:
 *         description: User logged in successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: 60d5f8c8b1b2e8a4f8c8b1b2
 *                 fullName:
 *                   type: string
 *                   example: John Doe
 *                 email:
 *                   type: string
 *                   example: john@example.com
 *                 phone:
 *                   type: string
 *                   example: 1234567890
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         description: Invalid credentials or email not verified
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: Invalid email or password
 */
router.post(
    '/login',
    [
        body('email').isEmail().withMessage('Invalid email format'),
        body('password').notEmpty().withMessage('Password is required'),
    ],
    async (req, res, next) => {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).send(errors.array()[0].msg)
        }
        try {
            const { email, password } = req.body
            const user = await authService.login(email, password)
            res.json(user)
        } catch (error) {
            return res.status(400).send(error.message)
        }
    }
)

module.exports = router
