const errorHandler = (err, req, res, next) => {
    console.error(err.stack)
    res.status(400).type('text/plain').send(err.message)
}

module.exports = errorHandler
