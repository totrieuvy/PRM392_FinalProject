const paymentService = require("../service/paymentService")


const handlePaymentCallback = async (req, res, callbackType) => {
    try {
        const result = await paymentService.handlePaymentReturn(req.query)
        
        console.log(`Payment ${callbackType} Result:`, result)

        const isSuccess = callbackType === 'Success'
        const deepLinkPath = isSuccess ? 'success' : 'cancel'
        const successParam = isSuccess ? 'true' : 'false'
        
        let deepLinkUrl = `myapp://payment/${deepLinkPath}?` + 
            `orderId=${result.orderId}&` +
            `orderCode=${result.orderCode}&` +
            `status=${result.status}&` +
            `success=${successParam}&` +
            `message=${encodeURIComponent(result.message)}`
        
        if (isSuccess) {
            deepLinkUrl += `&paymentCode=${req.query.orderCode}&` + `transactionId=${req.query.id}`
        } else {
            deepLinkUrl += `&cancelled=true`
        }
        
        console.log(`${callbackType} redirect to:`, deepLinkUrl)
        
        return res.redirect(deepLinkUrl)
    } catch (error) {
        console.error(`Payment ${callbackType} Error:`, {
            error: error.message,
            stack: error.stack,
            query: req.query,
            timestamp: new Date().toISOString()
        })
        
        const isCancel = callbackType === 'Cancel'
        let errorDeepLink = `myapp://payment/error?` +
            `error=${encodeURIComponent(error.message)}&` +
            `orderCode=${req.query.orderCode || ''}&` +
            `success=false`
        
        if (isCancel) {
            errorDeepLink += `&cancelled=true`
        }
        
        console.log(`${callbackType} error redirect to:`, errorDeepLink)
        
        return res.redirect(errorDeepLink)
    }
}

module.exports = {
  handlePaymentCallback
};