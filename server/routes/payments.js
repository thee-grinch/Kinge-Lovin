const express = require("express");
const router = express.Router();
const {
  createMesaPayment,
  getPaymentDetails,
  confirmMesaPayment,
  refundMesaPayment,
  cancelMesaPayment,
  getAllPayments
} = require("../controllers/payments");

// Payment endpoints
router.post("/mesa/create", createMesaPayment);
router.get("/mesa", getAllPayments);
router.get("/mesa/:id", getPaymentDetails);
router.post("/mesa/:id/confirm", confirmMesaPayment);
router.post("/mesa/:id/refund", refundMesaPayment);
router.post("/mesa/:id/cancel", cancelMesaPayment);

module.exports = router;
