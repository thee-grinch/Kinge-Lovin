const prisma = require("../utills/db");
const { asyncHandler, AppError } = require("../utills/errorHandler");

/**
 * Get overview analytics for dashboard
 * Includes: total orders, total revenue, total users, total products, etc.
 */
const getOverviewAnalytics = asyncHandler(async (request, response) => {
  // Get date range from query params (default to last 30 days)
  const days = parseInt(request.query.days) || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get all metrics in parallel
  const [
    totalOrders,
    totalRevenue,
    totalUsers,
    totalProducts,
    totalCategories,
    recentOrders,
    ordersByStatus
  ] = await Promise.all([
    // Total orders count
    prisma.customer_order.count(),
    
    // Total revenue (sum of all order totals)
    prisma.customer_order.aggregate({
      _sum: {
        total: true
      }
    }),
    
    // Total users count
    prisma.user.count(),
    
    // Total products count
    prisma.product.count(),
    
    // Total categories count
    prisma.category.count(),
    
    // Recent orders (last 30 days)
    prisma.customer_order.count({
      where: {
        dateTime: {
          gte: startDate
        }
      }
    }),
    
    // Orders grouped by status
    prisma.customer_order.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    })
  ]);

  // Calculate revenue for recent period
  const recentRevenue = await prisma.customer_order.aggregate({
    where: {
      dateTime: {
        gte: startDate
      }
    },
    _sum: {
      total: true
    }
  });

  return response.json({
    overview: {
      totalOrders,
      totalRevenue: totalRevenue._sum.total || 0,
      totalUsers,
      totalProducts,
      totalCategories,
      recentOrders,
      recentRevenue: recentRevenue._sum.total || 0,
      period: `${days} days`
    },
    ordersByStatus: ordersByStatus.map(item => ({
      status: item.status,
      count: item._count.status
    }))
  });
});

/**
 * Get order analytics with trends
 */
const getOrderAnalytics = asyncHandler(async (request, response) => {
  const days = parseInt(request.query.days) || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get orders with date grouping
  const orders = await prisma.customer_order.findMany({
    where: {
      dateTime: {
        gte: startDate
      }
    },
    orderBy: {
      dateTime: 'desc'
    }
  });

  // Group by date
  const ordersByDate = {};
  orders.forEach(order => {
    const date = order.dateTime.toISOString().split('T')[0];
    if (!ordersByDate[date]) {
      ordersByDate[date] = {
        count: 0,
        revenue: 0
      };
    }
    ordersByDate[date].count++;
    ordersByDate[date].revenue += order.total;
  });

  // Get order status breakdown
  const ordersByStatus = await prisma.customer_order.groupBy({
    by: ['status'],
    where: {
      dateTime: {
        gte: startDate
      }
    },
    _count: {
      status: true
    },
    _sum: {
      total: true
    }
  });

  return response.json({
    period: `${days} days`,
    totalOrders: orders.length,
    ordersByDate: Object.entries(ordersByDate).map(([date, data]) => ({
      date,
      count: data.count,
      revenue: data.revenue
    })),
    ordersByStatus: ordersByStatus.map(item => ({
      status: item.status,
      count: item._count.status,
      revenue: item._sum.total || 0
    }))
  });
});

/**
 * Get revenue analytics over time
 */
const getRevenueAnalytics = asyncHandler(async (request, response) => {
  const days = parseInt(request.query.days) || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const orders = await prisma.customer_order.findMany({
    where: {
      dateTime: {
        gte: startDate
      }
    },
    select: {
      dateTime: true,
      total: true,
      status: true
    },
    orderBy: {
      dateTime: 'asc'
    }
  });

  // Group revenue by date
  const revenueByDate = {};
  let totalRevenue = 0;

  orders.forEach(order => {
    const date = order.dateTime.toISOString().split('T')[0];
    if (!revenueByDate[date]) {
      revenueByDate[date] = 0;
    }
    revenueByDate[date] += order.total;
    totalRevenue += order.total;
  });

  // Calculate average order value
  const averageOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

  return response.json({
    period: `${days} days`,
    totalRevenue,
    averageOrderValue: Math.round(averageOrderValue * 100) / 100,
    orderCount: orders.length,
    revenueByDate: Object.entries(revenueByDate).map(([date, revenue]) => ({
      date,
      revenue
    }))
  });
});

/**
 * Get product performance analytics
 */
const getProductAnalytics = asyncHandler(async (request, response) => {
  const days = parseInt(request.query.days) || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get total products
  const totalProducts = await prisma.product.count();

  // Get products with low stock (less than 10)
  const lowStockProducts = await prisma.product.count({
    where: {
      inStock: {
        lt: 10
      }
    }
  });

  // Get out of stock products
  const outOfStockProducts = await prisma.product.count({
    where: {
      inStock: 0
    }
  });

  // Get top selling products (based on order items)
  const topProducts = await prisma.customer_order_product.groupBy({
    by: ['productId'],
    _sum: {
      quantity: true
    },
    orderBy: {
      _sum: {
        quantity: 'desc'
      }
    },
    take: 10
  });

  // Get product details for top products
  const productDetails = await Promise.all(
    topProducts.map(async (item) => {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: {
          id: true,
          title: true,
          price: true,
          inStock: true
        }
      });
      return {
        ...product,
        quantitySold: item._sum.quantity
      };
    })
  );

  return response.json({
    totalProducts,
    lowStockProducts,
    outOfStockProducts,
    topSellingProducts: productDetails
  });
});

/**
 * Get user growth analytics
 */
const getUserAnalytics = asyncHandler(async (request, response) => {
  const days = parseInt(request.query.days) || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get total users
  const totalUsers = await prisma.user.count();

  // Get users by role
  const usersByRole = await prisma.user.groupBy({
    by: ['role'],
    _count: {
      role: true
    }
  });

  return response.json({
    totalUsers,
    usersByRole: usersByRole.map(item => ({
      role: item.role || 'user',
      count: item._count.role
    })),
    period: `${days} days`
  });
});

/**
 * Get category distribution analytics
 */
const getCategoryAnalytics = asyncHandler(async (request, response) => {
  // Get all categories with product counts
  const categories = await prisma.category.findMany({
    include: {
      _count: {
        select: {
          products: true
        }
      }
    }
  });

  // Calculate total products
  const totalProducts = categories.reduce((sum, cat) => sum + cat._count.products, 0);

  // Get category revenue (products sold by category)
  const categoryData = await Promise.all(
    categories.map(async (category) => {
      // Get all products in this category
      const products = await prisma.product.findMany({
        where: { categoryId: category.id },
        select: { id: true }
      });

      const productIds = products.map(p => p.id);

      // Get total quantity sold for products in this category
      const sales = await prisma.customer_order_product.aggregate({
        where: {
          productId: {
            in: productIds
          }
        },
        _sum: {
          quantity: true
        }
      });

      return {
        id: category.id,
        name: category.name,
        productCount: category._count.products,
        totalSales: sales._sum.quantity || 0,
        percentage: totalProducts > 0 
          ? Math.round((category._count.products / totalProducts) * 100 * 100) / 100
          : 0
      };
    })
  );

  return response.json({
    totalCategories: categories.length,
    totalProducts,
    categories: categoryData.sort((a, b) => b.productCount - a.productCount)
  });
});

module.exports = {
  getOverviewAnalytics,
  getOrderAnalytics,
  getRevenueAnalytics,
  getProductAnalytics,
  getUserAnalytics,
  getCategoryAnalytics
};
