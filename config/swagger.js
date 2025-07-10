const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const swaggerOptions = {
  swaggerDefinition: {
    openapi: "3.0.0",
    info: {
      title: "PRM392-FLOWER SHOP",
      version: "1.0.0",
      description: "API for managing flower",
    },
    servers: [
      // {
      //     url: "http://localhost:3000",
      //     description: 'Local server',
      // },
      {
        url: "https://prm392-finalproject.onrender.com",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        Flower: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Flower ID",
            },
            name: {
              type: "string",
              description: "Flower name",
            },
            price: {
              type: "number",
              description: "Flower price",
            },
            description: {
              type: "string",
              description: "Flower description",
            },
            image: {
              type: "string",
              description: "Flower image URL",
            },
            category: {
              type: "object",
              properties: {
                _id: {
                  type: "string",
                },
                name: {
                  type: "string",
                },
              },
            },
            stock: {
              type: "number",
              description: "Available stock",
            },
            isActive: {
              type: "boolean",
              description: "Whether flower is active",
            },
            createBy: {
              type: "object",
              properties: {
                _id: {
                  type: "string",
                },
                fullName: {
                  type: "string",
                },
              },
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
        PaymentLinkRequest: {
          type: "object",
          required: ["orderId"],
          properties: {
            orderId: {
              type: "string",
              description: "ID of the order to create payment for",
            },
            returnUrl: {
              type: "string",
              description: "URL to redirect after successful payment (optional)",
            },
            cancelUrl: {
              type: "string",
              description: "URL to redirect after cancelled payment (optional)",
            },
          },
        },
        PaymentLinkResponse: {
          type: "object",
          properties: {
            checkoutUrl: {
              type: "string",
              description: "URL for customer to complete payment",
            },
            paymentCode: {
              type: "string",
              description: "Unique payment code",
            },
            transactionId: {
              type: "string",
              description: "Transaction ID",
            },
            orderId: {
              type: "string",
              description: "Order ID",
            },
            amount: {
              type: "number",
              description: "Payment amount",
            },
            qrCode: {
              type: "string",
              description: "QR code for payment",
            },
            paymentLinkId: {
              type: "string",
              description: "PayOS payment link ID",
            },
          },
        },
        Order: {
          type: "object",
          properties: {
            _id: {
              type: "string",
            },
            accountId: {
              type: "string",
            },
            totalAmount: {
              type: "number",
            },
            shippingFee: {
              type: "number",
            },
            status: {
              type: "string",
              enum: ["pending", "paid", "confirmed", "shipped", "delivered", "cancelled"],
            },
            addressShip: {
              type: "string",
            },
            orderAt: {
              type: "string",
              format: "date-time",
            },
            paidAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
        OrderResponse: {
          type: "object",
          properties: {
            _id: {
              type: "string",
            },
            accountId: {
              type: "object",
            },
            totalAmount: {
              type: "number",
            },
            status: {
              type: "string",
            },
            items: {
              type: "array",
              items: {
                type: "object",
              },
            },
          },
        },
        OrderItem: {
          type: "object",
          properties: {
            flowerId: {
              type: "string",
            },
            actualPrice: {
              type: "number",
            },
            quantity: {
              type: "number",
            },
            orderId: {
              type: "string",
            },
          },
        },
        OrderItemResponse: {
          type: "object",
          properties: {
            _id: {
              type: "string",
            },
            flowerId: {
              type: "object",
            },
            actualPrice: {
              type: "number",
            },
            quantity: {
              type: "number",
            },
            orderId: {
              type: "string",
            },
          },
        },
        Transaction: {
          type: "object",
          properties: {
            _id: {
              type: "string",
            },
            fromAccount: {
              type: "string",
            },
            toAccount: {
              type: "string",
            },
            amount: {
              type: "number",
            },
            transactionStatus: {
              type: "string",
              enum: ["pending", "completed", "failed", "cancelled"],
            },
            transactionDate: {
              type: "string",
              format: "date-time",
            },
          },
        },
        TransactionResponse: {
          type: "object",
          properties: {
            _id: {
              type: "string",
            },
            fromAccount: {
              type: "object",
            },
            toAccount: {
              type: "object",
            },
            amount: {
              type: "number",
            },
            transactionStatus: {
              type: "string",
            },
            transactionDate: {
              type: "string",
              format: "date-time",
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./routes/*.js"],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

module.exports = (app) => {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));
};
