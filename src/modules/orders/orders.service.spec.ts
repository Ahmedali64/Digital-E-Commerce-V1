/* eslint-disable @typescript-eslint/unbound-method */
import { Test } from '@nestjs/testing';
import { PaymentService } from '../payment/payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';
import { Decimal } from '@prisma/client/runtime/binary';
import { OrderStatus } from '@prisma/client';

describe('OrdersService', () => {
  // Test instances
  let service: OrdersService;
  let prismaService: PrismaService;
  let paymentService: PaymentService;
  beforeEach(async () => {
    // Create our tesing module
    const module = await Test.createTestingModule({
      providers: [
        // Service
        OrdersService,
        // Prisma
        {
          provide: PrismaService,
          useValue: {
            order: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
            },
            cart: {
              findUnique: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
            discountCode: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            discountUsage: {
              count: jest.fn(),
              create: jest.fn(),
            },
            cartItem: {
              deleteMany: jest.fn(),
            },
            payment: {
              create: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        // Payment
        {
          provide: PaymentService,
          useValue: {
            createPayment: jest.fn(),
          },
        },
      ],
    }).compile();

    // Get our testing modules after compilation
    service = module.get<OrdersService>(OrdersService);
    prismaService = module.get<PrismaService>(PrismaService);
    paymentService = module.get<PaymentService>(PaymentService);
  });

  // Create Order
  describe('createOrder', () => {
    it('should throw BadRequestException when cart is empty', async () => {
      // Arrange
      const mockEmptyCart = {
        id: 'cart-123',
        userId: 'user-123',
        items: [],
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prismaService.cart.findUnique as jest.Mock).mockResolvedValue(
        mockEmptyCart,
      );
      // Act + assert
      await expect(
        service.createOrder('user-123', { discountCode: 'SUMMER50' }),
      ).rejects.toThrow('Your cart is empty');
    });
    it('should create order successfully without discount', async () => {
      const mockCart = {
        id: 'cart-123',
        userId: 'user-123',
        items: [
          {
            id: 'cart-item-1',
            productId: 'product-1',
            priceAtAdd: new Decimal(100),
            product: {
              title: 'Test Book',
              authorName: 'Test Author',
              pdfFile: 'test.pdf',
            },
          },
          {
            id: 'cart-item-2',
            productId: 'product-2',
            priceAtAdd: new Decimal(50),
            product: {
              title: 'Another Book',
              authorName: 'Another Author',
              pdfFile: 'another.pdf',
            },
          },
        ],
      };

      const mockCreatedOrder = {
        id: 'order-123',
        userId: 'user-123',
        subtotal: new Decimal(150),
        discountAmount: new Decimal(0),
        total: new Decimal(150),
        status: OrderStatus.PENDING,
        discountCodeId: null,
        discountCodeUsed: null,
        createdAt: new Date(),
        paidAt: null,
        updatedAt: new Date(),
        items: [
          {
            id: 'order-item-1',
            productId: 'product-1',
            title: 'Test Book',
            authorName: 'Test Author',
            price: new Decimal(100),
            pdfFile: 'test.pdf',
          },
          {
            id: 'order-item-2',
            productId: 'product-2',
            title: 'Another Book',
            authorName: 'Another Author',
            price: new Decimal(50),
            pdfFile: 'another.pdf',
          },
        ],
      };

      const mockUser = {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      };

      const mockPaymentUrl = 'https://payment.example.com/pay/123';

      // Mock all the database calls
      (prismaService.cart.findUnique as jest.Mock).mockResolvedValue(mockCart);

      // Mock the transaction - make it execute the callback immediately
      (prismaService.$transaction as jest.Mock).mockImplementation(
        (callback) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
          return callback(prismaService);
        },
      );

      // Mock order creation inside transaction
      (prismaService.order.create as jest.Mock).mockResolvedValue(
        mockCreatedOrder,
      );

      // Mock payment creation inside transaction
      (prismaService.payment.create as jest.Mock).mockResolvedValue({
        id: 'payment-123',
        orderId: 'order-123',
        amount: new Decimal(150),
      });

      // Mock cart clearing inside transaction
      (prismaService.cartItem.deleteMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      // Mock user lookup after transaction
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      // Mock payment service
      (paymentService.createPayment as jest.Mock).mockResolvedValue(
        mockPaymentUrl,
      );

      // ACT - Call the method
      const result = await service.createOrder('user-123', {});

      // ASSERT - Check the result
      expect(result).toEqual({
        order: mockCreatedOrder,
        paymentUrl: mockPaymentUrl,
      });

      // Verify cart was fetched
      expect(prismaService.cart.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // Verify order was created
      expect(prismaService.order.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          userId: 'user-123',
          subtotal: 150,
          discountAmount: 0,
          total: 150,
          discountCodeId: undefined,
          discountCodeUsed: undefined,
          status: OrderStatus.PENDING,
        }),
        include: {
          items: true,
        },
      });

      // Verify payment was created
      expect(prismaService.payment.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          orderId: 'order-123',
          amount: 150,
          status: 'PENDING',
        }),
      });

      // Verify cart was cleared
      expect(prismaService.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart-123' },
      });

      // Verify payment URL was created
      expect(paymentService.createPayment).toHaveBeenCalledWith(
        'order-123',
        150,
        'test@example.com',
        'Test User',
      );
    });
    it('should create order successfully with valid discount code', async () => {
      // Arrange
      const mockCart = {
        id: 'cart-123',
        userId: 'user-123',
        items: [
          {
            id: 'cart-item-1',
            productId: 'product-1',
            priceAtAdd: new Decimal(200),
            product: {
              title: 'Test Book',
              authorName: 'Test Author',
              pdfFile: 'test.pdf',
            },
          },
        ],
      };

      const mockDiscount = {
        id: 'discount-123',
        code: 'SUMMER20',
        discountType: 'PERCENTAGE',
        discountValue: new Decimal(20),
        maxDiscount: null,
        minPurchase: new Decimal(100),
        usageLimit: 100,
        usageCount: 5,
        perUserLimit: 3,
        isActive: true,
        startsAt: new Date('2024-01-01'),
        expiresAt: new Date('2025-12-31'),
        description: '20% off',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockCreatedOrder = {
        id: 'order-123',
        userId: 'user-123',
        subtotal: new Decimal(200),
        discountAmount: new Decimal(40), // 20% of 200
        total: new Decimal(160),
        status: OrderStatus.PENDING,
        discountCodeId: 'discount-123',
        discountCodeUsed: 'SUMMER20',
        createdAt: new Date(),
        paidAt: null,
        updatedAt: new Date(),
        items: [
          {
            id: 'order-item-1',
            productId: 'product-1',
            title: 'Test Book',
            authorName: 'Test Author',
            price: new Decimal(200),
            pdfFile: 'test.pdf',
          },
        ],
      };

      const mockUser = {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      };

      const mockPaymentUrl = 'https://payment.example.com/pay/123';

      // Mock database calls
      (prismaService.cart.findUnique as jest.Mock).mockResolvedValue(mockCart);
      (prismaService.discountCode.findUnique as jest.Mock).mockResolvedValue(
        mockDiscount,
      );
      (prismaService.discountUsage.count as jest.Mock).mockResolvedValue(0);

      // Mock transaction
      (prismaService.$transaction as jest.Mock).mockImplementation(
        (callback) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
          return callback(prismaService);
        },
      );

      (prismaService.order.create as jest.Mock).mockResolvedValue(
        mockCreatedOrder,
      );
      (prismaService.payment.create as jest.Mock).mockResolvedValue({
        id: 'payment-123',
        orderId: 'order-123',
        amount: new Decimal(160),
      });
      (prismaService.discountUsage.create as jest.Mock).mockResolvedValue({
        id: 'usage-123',
        discountCodeId: 'discount-123',
        userId: 'user-123',
        orderId: 'order-123',
      });
      (prismaService.discountCode.update as jest.Mock).mockResolvedValue(
        mockDiscount,
      );
      (prismaService.cartItem.deleteMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (paymentService.createPayment as jest.Mock).mockResolvedValue(
        mockPaymentUrl,
      );

      // Act
      const result = await service.createOrder('user-123', {
        discountCode: 'SUMMER20',
      });

      // Assert
      expect(result).toEqual({
        order: mockCreatedOrder,
        paymentUrl: mockPaymentUrl,
      });

      // Verify discount code was validated
      expect(prismaService.discountCode.findUnique).toHaveBeenCalledWith({
        where: { code: 'SUMMER20' },
      });

      // Verify discount usage was checked
      expect(prismaService.discountUsage.count).toHaveBeenCalledWith({
        where: {
          discountCodeId: 'discount-123',
          userId: 'user-123',
        },
      });

      // Verify order was created with discount
      expect(prismaService.order.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          userId: 'user-123',
          subtotal: 200,
          discountAmount: 40,
          total: 160,
          discountCodeId: 'discount-123',
          discountCodeUsed: 'SUMMER20',
          status: OrderStatus.PENDING,
        }),
        include: {
          items: true,
        },
      });

      // Verify discount usage was recorded
      expect(prismaService.discountUsage.create).toHaveBeenCalledWith({
        data: {
          discountCodeId: 'discount-123',
          userId: 'user-123',
          orderId: 'order-123',
        },
      });

      // Verify discount usage count was incremented
      expect(prismaService.discountCode.update).toHaveBeenCalledWith({
        where: { id: 'discount-123' },
        data: {
          usageCount: { increment: 1 },
        },
      });

      // Verify payment was created with discounted total
      expect(paymentService.createPayment).toHaveBeenCalledWith(
        'order-123',
        160,
        'test@example.com',
        'Test User',
      );
    });

    // Test 2: Order total is zero or negative
    it('should throw BadRequestException when total is zero or negative', async () => {
      // Arrange
      const mockCart = {
        id: 'cart-123',
        userId: 'user-123',
        items: [
          {
            id: 'cart-item-1',
            productId: 'product-1',
            priceAtAdd: new Decimal(100),
            product: {
              title: 'Test Book',
              authorName: 'Test Author',
              pdfFile: 'test.pdf',
            },
          },
        ],
      };

      // 100% discount - makes total zero
      const mockDiscount = {
        id: 'discount-123',
        code: 'FREE100',
        discountType: 'PERCENTAGE',
        discountValue: new Decimal(100),
        maxDiscount: null,
        minPurchase: null,
        usageLimit: 100,
        usageCount: 5,
        perUserLimit: 3,
        isActive: true,
        startsAt: new Date('2024-01-01'),
        expiresAt: new Date('2025-12-31'),
        description: '100% off',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock database calls
      (prismaService.cart.findUnique as jest.Mock).mockResolvedValue(mockCart);
      (prismaService.discountCode.findUnique as jest.Mock).mockResolvedValue(
        mockDiscount,
      );
      (prismaService.discountUsage.count as jest.Mock).mockResolvedValue(0);

      // Act & Assert
      await expect(
        service.createOrder('user-123', { discountCode: 'FREE100' }),
      ).rejects.toThrow('Order total cannot be zero or negative');

      // Verify cart was checked
      expect(prismaService.cart.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // Verify discount was validated
      expect(prismaService.discountCode.findUnique).toHaveBeenCalledWith({
        where: { code: 'FREE100' },
      });

      // Verify transaction was never called (order creation didn't proceed)
      expect(prismaService.$transaction).not.toHaveBeenCalled();
    });
  });
  // Get User Orders
  describe('getUserOrders', () => {
    it('should return user orders with transformed data', async () => {
      // Arrange
      // Create fake data
      const mockOrders = [
        {
          id: 'order-1',
          userId: 'user-123',
          subtotal: new Decimal(100),
          discountAmount: new Decimal(10),
          total: new Decimal(90),
          status: OrderStatus.PAID,
          discountCodeId: 'discount-123',
          discountCodeUsed: 'SUMMER10',
          createdAt: new Date('2024-12-01'),
          paidAt: new Date('2024-12-01'),
          updatedAt: new Date('2024-12-01'),
          items: [
            {
              id: 'item-1',
              orderId: 'order-1',
              productId: 'product-1',
              title: 'Test Book',
              authorName: 'Test Author',
              price: new Decimal(100),
              pdfFile: 'test.pdf',
              createdAt: new Date('2024-12-01'),
            },
          ],
        },
        {
          id: 'order-2',
          userId: 'user-123',
          subtotal: new Decimal(50),
          discountAmount: new Decimal(0),
          total: new Decimal(50),
          status: OrderStatus.PENDING,
          discountCodeId: null,
          discountCodeUsed: null,
          createdAt: new Date('2024-12-05'),
          paidAt: null,
          updatedAt: new Date('2024-12-05'),
          items: [
            {
              id: 'item-2',
              orderId: 'order-2',
              productId: 'product-2',
              title: 'Another Book',
              authorName: 'Another Author',
              price: new Decimal(50),
              pdfFile: 'another.pdf',
              createdAt: new Date('2024-12-05'),
            },
          ],
        },
      ];

      // Retrun fake data (When this func is called return these data)
      (prismaService.order.findMany as jest.Mock).mockResolvedValue(mockOrders);

      // ACT
      // Then we make the actuall func calling
      const result = await service.getUserOrders('user-123');

      // ASSERT
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'order-1',
        subtotal: 100,
        discountAmount: 10,
        total: 90,
        status: OrderStatus.PAID,
        createdAt: mockOrders[0].createdAt,
        paidAt: mockOrders[0].paidAt,
        discountCodeUsed: 'SUMMER10',
        items: [
          {
            id: 'item-1',
            title: 'Test Book',
            authorName: 'Test Author',
            price: 100,
            pdfFile: 'test.pdf',
          },
        ],
      });

      // Verify the mock was called correctly
      expect(prismaService.order.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      });
    });
    it('should return empty array when user has no orders', async () => {
      // ARRANGE
      (prismaService.order.findMany as jest.Mock).mockResolvedValue([]);

      // ACT
      const result = await service.getUserOrders('user-123');

      // ASSERT
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });
  // Get Order By Id
  describe('getOrderById', () => {
    it('should return user order with the specified id', async () => {
      // Arrange
      const mockOrder = {
        id: 'order-2',
        userId: 'user-123',
        subtotal: new Decimal(50),
        discountAmount: new Decimal(0),
        total: new Decimal(50),
        status: OrderStatus.PENDING,
        discountCodeId: null,
        discountCodeUsed: null,
        createdAt: new Date('2024-12-05'),
        paidAt: null,
        updatedAt: new Date('2024-12-05'),
        items: [
          {
            id: 'item-2',
            orderId: 'order-2',
            productId: 'product-2',
            title: 'Another Book',
            authorName: 'Another Author',
            price: new Decimal(50),
            pdfFile: 'another.pdf',
            createdAt: new Date('2024-12-05'),
          },
        ],
      };

      (prismaService.order.findFirst as jest.Mock).mockResolvedValue(mockOrder);

      // Act
      const result = await service.getOrderById('order-2', 'user-123');

      // Assert
      expect(result).toEqual({
        id: 'order-2',
        subtotal: 50,
        discountAmount: 0,
        total: 50,
        status: OrderStatus.PENDING,
        createdAt: mockOrder.createdAt,
        paidAt: null,
        discountCodeUsed: null,
        items: [
          {
            id: 'item-2',
            title: 'Another Book',
            authorName: 'Another Author',
            price: 50,
            pdfFile: 'another.pdf',
          },
        ],
      });
      expect(prismaService.order.findFirst).toHaveBeenCalledWith({
        where: { id: 'order-2', userId: 'user-123' },
        include: { items: true },
      });
    });
    it('should throw NotFoundException when order does not exist', async () => {
      (prismaService.order.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        service.getOrderById('nonexistent-id', 'user-123'),
      ).rejects.toThrow('Order not found');
    });
    it('should throw NotFoundException when order belongs to different user', async () => {
      (prismaService.order.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        service.getOrderById('order-2', 'wrong-user-id'),
      ).rejects.toThrow('Order not found');
    });
  });
});
