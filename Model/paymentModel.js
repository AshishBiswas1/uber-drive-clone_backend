const mongoose = require('mongoose');

const paymentSchema = mongoose.Schema({});

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;
