const prisma = require("../utills/db");
const { asyncHandler, AppError } = require("../utills/errorHandler");
const { nanoid } = require("nanoid");

/**
 * Create a new Mesa payment
 * POST /api/payments/mesa/create
 */
const createMesaPayment = asyncHandler(async (request, response) => {
  const { orderId, amount, currency, paymentDetails } = request.body;

  // Validation
  if (!orderId) {
    throw new AppError("Order ID is required", 400);
  }

  if (!amount || amount <= 0) {
    throw new AppError("Valid payment amount is required", 400);
  }

  // Check if order exists
  const order = await prisma.customer_order.findUnique({
    where: { id: orderId }
  });

  if (!order) {
    throw new AppError("Order not found", 404);
  }

  // Check if payment already exists for this order
  const existingPayment = await prisma.payment.findUnique({
    where: { orderId: orderId }
  });

  if (existingPayment) {
    throw new AppError("Payment already exists for this order", 409);
  }

  // Verify amount matches order total
  if (amount !== order.total) {
    throw new AppError("Payment amount must match order total", 400);
  }

  // Generate unique transaction ID
  const transactionId = `MESA-${nanoid(16)}`;

  // Create payment record
  const payment = await prisma.payment.create({
    data: {
      orderId,
      amount,
      currency: currency || "USD",
      status: "PENDING",
      method: "MESA",
      transactionId,
      paymentDetails: paymentDetails || {}
    }
  });

  return response.status(201).json({
    success: true,
    payment: {
      id: payment.id,
      transactionId: payment.transactionId,
      orderId: payment.orderId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      method: payment.method,
      createdAt: payment.createdAt
    },
    message: "Mesa payment initiated successfully"
  });
});

/**
 * Get payment details by payment ID
 * GET /api/payments/mesa/:id
 */
const getPaymentDetails = asyncHandler(async (request, response) => {
  const { id } = request.params;

  if (!id) {
    throw new AppError("Payment ID is required", 400);
  }

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      order: {
        select: {
          id: true,
          name: true,
          lastname: true,
          email: true,
          total: true,
          status: true,
          dateTime: true
        }
      }
    }
  });

  if (!payment) {
    throw new AppError("Payment not found", 404);
  }

  return response.json({
    success: true,
    payment: {
      id: payment.id,
      transactionId: payment.transactionId,
      orderId: payment.orderId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      method: payment.method,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      completedAt: payment.completedAt,
      refundedAt: payment.refundedAt,
      errorMessage: payment.errorMessage,
      order: payment.order
    }
  });
});

/**
 * Confirm/complete a Mesa payment
 * POST /api/payments/mesa/:id/confirm
 */
const confirmMesaPayment = asyncHandler(async (request, response) => {
  const { id } = request.params;
  const { paymentDetails } = request.body;

  if (!id) {
    throw new AppError("Payment ID is required", 400);
  }

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { order: true }
  });

  if (!payment) {
    throw new AppError("Payment not found", 404);
  }

  if (payment.status === "COMPLETED") {
    throw new AppError("Payment already completed", 400);
  }

  if (payment.status === "REFUNDED") {
    throw new AppError("Cannot confirm refunded payment", 400);
  }

  if (payment.status === "CANCELLED") {
    throw new AppError("Cannot confirm cancelled payment", 400);
  }

  // Update payment status to PROCESSING then COMPLETED
  const updatedPayment = await prisma.payment.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      paymentDetails: paymentDetails || payment.paymentDetails
    }
  });

  // Optionally update order status
  await prisma.customer_order.update({
    where: { id: payment.orderId },
    data: {
      status: "paid"
    }
  });

  return response.json({
    success: true,
    payment: {
      id: updatedPayment.id,
      transactionId: updatedPayment.transactionId,
      orderId: updatedPayment.orderId,
      amount: updatedPayment.amount,
      currency: updatedPayment.currency,
      status: updatedPayment.status,
      completedAt: updatedPayment.completedAt
    },
    message: "Payment confirmed successfully"
  });
});

/**
 * Refund a Mesa payment
 * POST /api/payments/mesa/:id/refund
 */
const refundMesaPayment = asyncHandler(async (request, response) => {
  const { id } = request.params;
  const { reason } = request.body;

  if (!id) {
    throw new AppError("Payment ID is required", 400);
  }

  const payment = await prisma.payment.findUnique({
    where: { id }
  });

  if (!payment) {
    throw new AppError("Payment not found", 404);
  }

  if (payment.status !== "COMPLETED") {
    throw new AppError("Only completed payments can be refunded", 400);
  }

  if (payment.status === "REFUNDED") {
    throw new AppError("Payment already refunded", 400);
  }

  // Update payment status to REFUNDED
  const updatedPayment = await prisma.payment.update({
    where: { id },
    data: {
      status: "REFUNDED",
      refundedAt: new Date(),
      errorMessage: reason || "Payment refunded"
    }
  });

  // Update order status
  await prisma.customer_order.update({
    where: { id: payment.orderId },
    data: {
      status: "refunded"
    }
  });

  return response.json({
    success: true,
    payment: {
      id: updatedPayment.id,
      transactionId: updatedPayment.transactionId,
      orderId: updatedPayment.orderId,
      amount: updatedPayment.amount,
      status: updatedPayment.status,
      refundedAt: updatedPayment.refundedAt
    },
    message: "Payment refunded successfully"
  });
});

/**
 * Cancel a pending payment
 * POST /api/payments/mesa/:id/cancel
 */
const cancelMesaPayment = asyncHandler(async (request, response) => {
  const { id } = request.params;
  const { reason } = request.body;

  if (!id) {
    throw new AppError("Payment ID is required", 400);
  }

  const payment = await prisma.payment.findUnique({
    where: { id }
  });

  if (!payment) {
    throw new AppError("Payment not found", 404);
  }

  if (payment.status === "COMPLETED") {
    throw new AppError("Cannot cancel completed payment. Use refund instead.", 400);
  }

  if (payment.status === "REFUNDED") {
    throw new AppError("Cannot cancel refunded payment", 400);
  }

  if (payment.status === "CANCELLED") {
    throw new AppError("Payment already cancelled", 400);
  }

  // Update payment status to CANCELLED
  const updatedPayment = await prisma.payment.update({
    where: { id },
    data: {
      status: "CANCELLED",
      errorMessage: reason || "Payment cancelled"
    }
  });

  return response.json({
    success: true,
    payment: {
      id: updatedPayment.id,
      transactionId: updatedPayment.transactionId,
      status: updatedPayment.status
    },
    message: "Payment cancelled successfully"
  });
});

/**
 * Get all payments with optional filters
 * GET /api/payments/mesa
 */
const getAllPayments = asyncHandler(async (request, response) => {
  const page = parseInt(request.query.page) || 1;
  const limit = parseInt(request.query.limit) || 50;
  const status = request.query.status;
  const offset = (page - 1) * limit;

  // Build filter
  const where = {};
  if (status) {
    where.status = status.toUpperCase();
  }

  // Validate pagination parameters
  if (page < 1 || limit < 1 || limit > 100) {
    throw new AppError("Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 100", 400);
  }

  const [payments, totalCount] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        order: {
          select: {
            id: true,
            email: true,
            total: true,
            status: true
          }
        }
      }
    }),
    prisma.payment.count({ where })
  ]);

  return response.json({
    success: true,
    payments,
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit)
    }
  });
});

module.exports = {
  createMesaPayment,
  getPaymentDetails,
  confirmMesaPayment,
  refundMesaPayment,
  cancelMesaPayment,
  getAllPayments
};
