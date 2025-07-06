var createError = require('http-errors')
var express = require('express')
var path = require('path')
var cookieParser = require('cookie-parser')
var logger = require('morgan')
const cors = require('cors')
require('dotenv').config()
const setupSwagger = require('./config/swagger')
const mongoose = require('mongoose')
const redis = require('redis')
const errorHandler = require('./middlewares/errorHandler')

mongoose
    .connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => {
        console.log('Connected to MongoDB')
    })
    .catch((err) => {
        console.error('MongoDB connection error:', err)
    })

const redisClient = redis.createClient({
    url: process.env.REDIS_URL,
    socket: {
        tls: true,
    },
})

redisClient
    .connect()
    .then(() => console.log('✅ Connected to Redis via Upstash'))
    .catch(console.error)

//import routes
const authRoutes = require('./routes/authRoutes')
const categoryRoutes = require('./routes/categoryRoutes')
const flowerRoutes = require('./routes/flowerRoutes')
const profileRoutes = require('./routes/profileRoutes')
const orderRoutes = require('./routes/orderRoutes')
const orderItemRoutes = require('./routes/orderItemRoutes')
const paymentRoutes = require('./routes/paymentRoutes')
const transactionRoutes = require('./routes/transactionRoutes')

const app = express()

app.use(express.json())
app.use(cookieParser())
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.urlencoded({ extended: true }))

app.use(
    cors({
        origin: '*',
    })
)

setupSwagger(app)

app.use('/api/auth', authRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/flowers', flowerRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/order-items', orderItemRoutes)
app.use('/api', paymentRoutes)
app.use('/api/transactions', transactionRoutes)

app.get('/', (req, res) => {
    res.send('Hello world PRM392')
})

app.use(errorHandler)

const PORT = process.env.PORT

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`)
})
