const express = require("express");
const router = express.Router();
const {
  getOverviewAnalytics,
  getOrderAnalytics,
  getRevenueAnalytics,
  getProductAnalytics,
  getUserAnalytics,
  getCategoryAnalytics
} = require("../controllers/analytics");

// Analytics endpoints
router.get("/overview", getOverviewAnalytics);
router.get("/orders", getOrderAnalytics);
router.get("/revenue", getRevenueAnalytics);
router.get("/products", getProductAnalytics);
router.get("/users", getUserAnalytics);
router.get("/categories", getCategoryAnalytics);

module.exports = router;
