# Backend API Documentation

This document provides comprehensive information about the backend API endpoints for the Kinge-Lovin e-commerce platform.

## Table of Contents

1. [Analytics Endpoints](#analytics-endpoints)
2. [Payment Endpoints](#payment-endpoints)
3. [User Management Endpoints](#user-management-endpoints)
4. [Category Management Endpoints](#category-management-endpoints)
5. [Order Management Endpoints](#order-management-endpoints)

---

## Analytics Endpoints

All analytics endpoints support an optional `days` query parameter (default: 30) to specify the time range for data aggregation.

### GET /api/analytics/overview

Get overall dashboard statistics including orders, revenue, users, products, and categories.

**Query Parameters:**
- `days` (optional): Number of days to look back (default: 30)

**Response:**
```json
{
  "overview": {
    "totalOrders": 150,
    "totalRevenue": 45000,
    "totalUsers": 50,
    "totalProducts": 200,
    "totalCategories": 10,
    "recentOrders": 25,
    "recentRevenue": 7500,
    "period": "30 days"
  },
  "ordersByStatus": [
    { "status": "confirmed", "count": 100 },
    { "status": "pending", "count": 30 },
    { "status": "shipped", "count": 20 }
  ]
}
```

### GET /api/analytics/orders

Get order analytics with trends and status breakdown.

**Query Parameters:**
- `days` (optional): Number of days to look back (default: 30)

**Response:**
```json
{
  "period": "30 days",
  "totalOrders": 25,
  "ordersByDate": [
    { "date": "2024-12-01", "count": 5, "revenue": 1500 },
    { "date": "2024-12-02", "count": 3, "revenue": 900 }
  ],
  "ordersByStatus": [
    { "status": "confirmed", "count": 15, "revenue": 4500 },
    { "status": "pending", "count": 10, "revenue": 3000 }
  ]
}
```

### GET /api/analytics/revenue

Get revenue analytics over time.

**Query Parameters:**
- `days` (optional): Number of days to look back (default: 30)

**Response:**
```json
{
  "period": "30 days",
  "totalRevenue": 7500,
  "averageOrderValue": 300,
  "orderCount": 25,
  "revenueByDate": [
    { "date": "2024-12-01", "revenue": 1500 },
    { "date": "2024-12-02", "revenue": 900 }
  ]
}
```

### GET /api/analytics/products

Get product performance analytics including stock levels and top-selling products.

**Query Parameters:**
- `days` (optional): Number of days to look back (default: 30)

**Response:**
```json
{
  "totalProducts": 200,
  "lowStockProducts": 15,
  "outOfStockProducts": 3,
  "topSellingProducts": [
    {
      "id": "prod-123",
      "title": "Laptop XYZ",
      "price": 1200,
      "inStock": 5,
      "quantitySold": 50
    }
  ]
}
```

### GET /api/analytics/users

Get user growth and distribution analytics.

**Query Parameters:**
- `days` (optional): Number of days to look back (default: 30)

**Response:**
```json
{
  "totalUsers": 50,
  "usersByRole": [
    { "role": "user", "count": 45 },
    { "role": "admin", "count": 5 }
  ],
  "period": "30 days"
}
```

### GET /api/analytics/categories

Get category distribution and performance analytics.

**Response:**
```json
{
  "totalCategories": 10,
  "totalProducts": 200,
  "categories": [
    {
      "id": "cat-123",
      "name": "Laptops",
      "productCount": 50,
      "totalSales": 150,
      "percentage": 25.0
    }
  ]
}
```

---

## Payment Endpoints

### POST /api/payments/mesa/create

Create a new Mesa payment for an order.

**Request Body:**
```json
{
  "orderId": "order-123",
  "amount": 1500,
  "currency": "USD",
  "paymentDetails": {
    "customerName": "John Doe",
    "email": "john@example.com"
  }
}
```

**Response:**
```json
{
  "success": true,
  "payment": {
    "id": "pay-123",
    "transactionId": "MESA-abc123xyz456",
    "orderId": "order-123",
    "amount": 1500,
    "currency": "USD",
    "status": "PENDING",
    "method": "MESA",
    "createdAt": "2024-12-06T13:00:00.000Z"
  },
  "message": "Mesa payment initiated successfully"
}
```

### GET /api/payments/mesa

Get all payments with optional filtering and pagination.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 50, max: 100)
- `status` (optional): Filter by payment status (PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED, CANCELLED)

**Response:**
```json
{
  "success": true,
  "payments": [
    {
      "id": "pay-123",
      "transactionId": "MESA-abc123xyz456",
      "orderId": "order-123",
      "amount": 1500,
      "currency": "USD",
      "status": "COMPLETED",
      "method": "MESA",
      "createdAt": "2024-12-06T13:00:00.000Z",
      "order": {
        "id": "order-123",
        "email": "john@example.com",
        "total": 1500,
        "status": "paid"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2
  }
}
```

### GET /api/payments/mesa/:id

Get details of a specific payment.

**Response:**
```json
{
  "success": true,
  "payment": {
    "id": "pay-123",
    "transactionId": "MESA-abc123xyz456",
    "orderId": "order-123",
    "amount": 1500,
    "currency": "USD",
    "status": "COMPLETED",
    "method": "MESA",
    "createdAt": "2024-12-06T13:00:00.000Z",
    "updatedAt": "2024-12-06T13:05:00.000Z",
    "completedAt": "2024-12-06T13:05:00.000Z",
    "order": {
      "id": "order-123",
      "name": "John",
      "lastname": "Doe",
      "email": "john@example.com",
      "total": 1500,
      "status": "paid",
      "dateTime": "2024-12-06T12:00:00.000Z"
    }
  }
}
```

### POST /api/payments/mesa/:id/confirm

Confirm and complete a pending payment.

**Request Body (optional):**
```json
{
  "paymentDetails": {
    "confirmationCode": "CONF-123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "payment": {
    "id": "pay-123",
    "transactionId": "MESA-abc123xyz456",
    "orderId": "order-123",
    "amount": 1500,
    "currency": "USD",
    "status": "COMPLETED",
    "completedAt": "2024-12-06T13:05:00.000Z"
  },
  "message": "Payment confirmed successfully"
}
```

### POST /api/payments/mesa/:id/refund

Refund a completed payment.

**Request Body (optional):**
```json
{
  "reason": "Customer requested refund"
}
```

**Response:**
```json
{
  "success": true,
  "payment": {
    "id": "pay-123",
    "transactionId": "MESA-abc123xyz456",
    "orderId": "order-123",
    "amount": 1500,
    "status": "REFUNDED",
    "refundedAt": "2024-12-06T14:00:00.000Z"
  },
  "message": "Payment refunded successfully"
}
```

### POST /api/payments/mesa/:id/cancel

Cancel a pending payment.

**Request Body (optional):**
```json
{
  "reason": "Order cancelled by customer"
}
```

**Response:**
```json
{
  "success": true,
  "payment": {
    "id": "pay-123",
    "transactionId": "MESA-abc123xyz456",
    "status": "CANCELLED"
  },
  "message": "Payment cancelled successfully"
}
```

---

## User Management Endpoints

### GET /api/users
Get all users (passwords excluded from response).

### POST /api/users
Create a new user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "role": "user"
}
```

### GET /api/users/:id
Get a specific user by ID.

### PUT /api/users/:id
Update a user.

### DELETE /api/users/:id
Delete a user.

### GET /api/users/email/:email
Get a user by email address.

---

## Category Management Endpoints

### GET /api/categories
Get all categories.

### POST /api/categories
Create a new category.

**Request Body:**
```json
{
  "name": "Electronics"
}
```

### GET /api/categories/:id
Get a specific category.

### PUT /api/categories/:id
Update a category.

### DELETE /api/categories/:id
Delete a category (only if it has no products).

---

## Order Management Endpoints

### GET /api/orders
Get all orders with pagination.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 50, max: 100)

### POST /api/orders
Create a new order.

**Request Body:**
```json
{
  "name": "John",
  "lastname": "Doe",
  "phone": "+1234567890",
  "email": "john@example.com",
  "company": "ACME Corp",
  "adress": "123 Main St",
  "apartment": "Apt 4B",
  "postalCode": "12345",
  "city": "New York",
  "country": "USA",
  "status": "pending",
  "total": 1500,
  "orderNotice": "Please deliver before 5 PM"
}
```

### GET /api/orders/:id
Get a specific order.

### PUT /api/orders/:id
Update an order.

### DELETE /api/orders/:id
Delete an order.

---

## Error Responses

All endpoints follow a consistent error response format:

```json
{
  "error": "Error message",
  "details": "Detailed error information or validation errors"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `204` - No Content (successful deletion)
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `500` - Internal Server Error

---

## Authentication & Rate Limiting

All endpoints are protected by rate limiting:
- General endpoints: 100 requests per 15 minutes
- Authentication endpoints: 5 attempts per 15 minutes
- Upload endpoints: 10 uploads per 15 minutes
- Search endpoints: 30 searches per minute
- Order endpoints: 15 operations per 15 minutes

## Database Schema

The Payment model includes:
- Enums: `PaymentStatus`, `PaymentMethod`
- Relationship: One-to-one with `Customer_order`
- Indexes on: `orderId`, `status`, `transactionId`
- Cascade delete: Payment is deleted when order is deleted
