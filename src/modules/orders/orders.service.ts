import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto, OrderResponseDto } from './dto';
import { calculateDiscount } from 'src/common/utils/calculate-discount.util';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { PaymentService } from '../payment/payment.service';
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
  ) {}

  async createOrder(userId: string, dto: CreateOrderDto) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      this.logger.warn(`User ${userId} has empty cart`);
      throw new BadRequestException('Your cart is empty');
    }

    const subtotal = cart.items.reduce((sum, item) => {
      return sum + Number(item.priceAtAdd);
    }, 0);

    let discountAmount = 0;
    let discountCodeId: string | undefined;
    let discountCodeUsed: string | undefined;

    if (dto.discountCode) {
      const discount = await this.validateAndGetDiscount(
        dto.discountCode,
        userId,
        subtotal,
      );

      discountAmount = calculateDiscount(
        subtotal,
        discount.discountType,
        Number(discount.discountValue),
        discount.maxDiscount ? Number(discount.maxDiscount) : null,
      );

      discountCodeId = discount.id;
      discountCodeUsed = discount.code;

      this.logger.log(
        `Discount applied: ${discountCodeUsed} - ${discountAmount} EGP off`,
      );
    }

    const total = subtotal - discountAmount;
    if (total <= 0) {
      throw new BadRequestException('Order total cannot be zero or negative');
    }

    const order = await this.prisma.$transaction(async (tx) => {
      // Create the order/order items
      const newOrder = await tx.order.create({
        data: {
          userId,
          subtotal,
          discountAmount,
          total,
          discountCodeId,
          discountCodeUsed,
          status: OrderStatus.PENDING,
          // Create order items from cart items
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              title: item.product.title,
              authorName: item.product.authorName,
              price: item.priceAtAdd,
              pdfFile: item.product.pdfFile,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // Create payment record (initially PENDING)
      await tx.payment.create({
        data: {
          orderId: newOrder.id,
          amount: total,
          status: PaymentStatus.PENDING,
        },
      });

      // If discount was used, record the usage
      if (discountCodeId) {
        await tx.discountUsage.create({
          data: {
            discountCodeId,
            userId,
            orderId: newOrder.id,
          },
        });

        // Increment usage count
        await tx.discountCode.update({
          where: { id: discountCodeId },
          data: {
            usageCount: { increment: 1 },
          },
        });
      }

      // Clear the cart after order creation
      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      return newOrder;
    });

    this.logger.log(`Order created: ${order.id} - Total: ${total} EGP`);

    //Get user info for payment
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    // Create payment URL
    const userName = `${user?.firstName} ${user?.lastName}`;
    const paymentUrl = await this.paymentService.createPayment(
      order.id,
      Number(total),
      user!.email,
      userName,
    );

    // Return order + payment URL
    return {
      order,
      paymentUrl, // Frontend will redirect user here
    };
  }

  async getUserOrders(userId: string): Promise<OrderResponseDto[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return orders.map((order) => ({
      id: order.id,
      subtotal: Number(order.subtotal),
      discountAmount: Number(order.discountAmount),
      total: Number(order.total),
      status: order.status,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      discountCodeUsed: order.discountCodeUsed,
      items: order.items.map((item) => ({
        id: item.id,
        title: item.title,
        authorName: item.authorName,
        price: Number(item.price),
        pdfFile: item.pdfFile,
      })),
    }));
  }

  async getOrderById(
    orderId: string,
    userId: string,
  ): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId, // Ensure user owns this order
      },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return {
      id: order.id,
      subtotal: Number(order.subtotal),
      discountAmount: Number(order.discountAmount),
      total: Number(order.total),
      status: order.status,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      discountCodeUsed: order.discountCodeUsed,
      items: order.items.map((item) => ({
        id: item.id,
        title: item.title,
        authorName: item.authorName,
        price: Number(item.price),
        pdfFile: item.pdfFile,
      })),
    };
  }
  // Helpers
  private async validateAndGetDiscount(
    code: string,
    userId: string,
    subtotal: number,
  ) {
    const discount = await this.prisma.discountCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!discount) {
      throw new BadRequestException('Invalid discount code');
    }

    if (!discount.isActive) {
      throw new BadRequestException('This discount code is no longer active');
    }

    // Check if expired
    const now = new Date();
    if (discount.startsAt && discount.startsAt > now) {
      throw new BadRequestException('This discount code is not yet active');
    }
    if (discount.expiresAt && discount.expiresAt < now) {
      throw new BadRequestException('This discount code has expired');
    }

    // Check usage limits
    if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
      throw new BadRequestException('This discount code has been fully used');
    }

    // Check per-user limit
    if (discount.perUserLimit) {
      const userUsageCount = await this.prisma.discountUsage.count({
        where: {
          discountCodeId: discount.id,
          userId,
        },
      });

      if (userUsageCount >= discount.perUserLimit) {
        throw new BadRequestException(
          'You have already used this discount code the maximum number of times',
        );
      }
    }

    // Check minimum purchase
    if (discount.minPurchase && subtotal < Number(discount.minPurchase)) {
      throw new BadRequestException(
        `Minimum purchase of ${discount.minPurchase.toString()} EGP required for this discount`,
      );
    }

    return discount;
  }
}
