import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CartDto } from './dto';
import type { Cache } from 'cache-manager';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);
  private readonly CART_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
  private readonly CART_PREFIX = 'cart:';

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // Get user's cart (from Redis first, fallback to DB)
  async getCart(userId: string): Promise<CartDto> {
    this.logger.log(`Fetching cart for user: ${userId}`);

    const cacheKey = `${this.CART_PREFIX}${userId}`;
    const cachedCart = await this.cacheManager.get<CartDto>(cacheKey);

    if (cachedCart) {
      this.logger.log(`Cart found in Redis for user: ${userId}`);
      return cachedCart;
    }

    const cart = await this.fetchCartFromDB(userId);

    await this.cacheManager.set(cacheKey, cart, this.CART_TTL);

    return cart;
  }

  async addItem(userId: string, productId: string): Promise<CartDto> {
    this.logger.log(`Adding product ${productId} to cart for user: ${userId}`);

    const product = await this.prisma.product.findUnique({
      where: {
        id: productId,
        isPublished: true,
        deletedAt: null,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found or not available');
    }

    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: true,
      },
    });

    if (!cart) {
      // Create new cart with the item
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      cart = await this.prisma.cart.create({
        data: {
          userId,
          expiresAt,
          items: {
            create: {
              productId: productId,
              priceAtAdd: product.price,
            },
          },
        },
        include: {
          items: true,
        },
      });

      this.logger.log(`New cart created for user: ${userId}`);
    } else {
      const existingItem = cart.items.find(
        (item) => item.productId === productId,
      );

      if (existingItem) {
        // Product already in cart - for digital products, this is not an error
        // Just return current cart
        this.logger.log(`Product ${productId} already in cart`);
        throw new ConflictException('This product is already in your cart');
      }

      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: productId,
          priceAtAdd: product.price,
        },
      });

      this.logger.log(`Added new item to cart: ${productId}`);

      // Extend expiration
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 7);

      await this.prisma.cart.update({
        where: { id: cart.id },
        data: { expiresAt: newExpiresAt },
      });
    }

    // Invalidate cache and return fresh cart
    await this.invalidateCache(userId);
    return this.getCart(userId);
  }

  async clearCart(userId: string): Promise<void> {
    this.logger.log(`Clearing cart for user: ${userId}`);

    const cart = await this.prisma.cart.findUnique({
      where: { userId },
    });

    if (cart) {
      await this.prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
      });
    }

    await this.invalidateCache(userId);
  }

  async applyDiscount(userId: string, code: string): Promise<CartDto> {
    this.logger.log(`Applying discount code ${code} for user: ${userId}`);

    // Validate discount code
    const discount = await this.prisma.discountCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!discount) {
      throw new NotFoundException('Invalid discount code');
    }

    if (!discount.isActive) {
      throw new BadRequestException('This discount code is not active');
    }

    // Check expiration
    const now = new Date();
    if (discount.expiresAt && discount.expiresAt < now) {
      throw new BadRequestException('This discount code has expired');
    }

    if (discount.startsAt && discount.startsAt > now) {
      throw new BadRequestException('This discount code is not yet valid');
    }

    // Check usage limit
    if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
      throw new BadRequestException(
        'This discount code has reached its usage limit',
      );
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

    // Get cart and check minimum purchase
    const cart = await this.getCart(userId);

    if (cart.items.length === 0) {
      throw new BadRequestException('Your cart is empty');
    }

    if (discount.minPurchase && cart.subtotal < Number(discount.minPurchase)) {
      throw new BadRequestException(
        `Minimum purchase of $${String(discount.minPurchase)} required for this discount`,
      );
    }

    // Store discount code in Redis
    const cacheKey = `${this.CART_PREFIX}${userId}:discount`;
    await this.cacheManager.set(cacheKey, code.toUpperCase(), this.CART_TTL);

    // Invalidate cart cache to recalculate with discount
    await this.invalidateCache(userId);

    this.logger.log(`Discount code applied: ${code}`);
    return this.getCart(userId);
  }

  async removeDiscount(userId: string): Promise<CartDto> {
    const cacheKey = `${this.CART_PREFIX}${userId}:discount`;
    await this.cacheManager.del(cacheKey);
    await this.invalidateCache(userId);
    return this.getCart(userId);
  }

  async removeItem(userId: string, productId: string): Promise<CartDto> {
    this.logger.log(`Removing item ${productId} from cart for user: ${userId}`);

    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: { items: true },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    const item = cart.items.find((i) => i.productId === productId);

    if (!item) {
      throw new NotFoundException('Item not found in cart');
    }

    await this.prisma.cartItem.delete({
      where: { id: item.id },
    });

    this.logger.log(`Item removed: ${productId}`);

    await this.invalidateCache(userId);
    return this.getCart(userId);
  }
  // Helper Functions
  private async fetchCartFromDB(userId: string): Promise<CartDto> {
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                slug: true,
                coverImage: true,
                price: true,
                discountPercentage: true,
                saleEndsAt: true,
                isPublished: true,
                deletedAt: true,
              },
            },
          },
        },
      },
    });

    if (!cart) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      cart = await this.prisma.cart.create({
        data: {
          userId,
          expiresAt,
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  coverImage: true,
                  price: true,
                  discountPercentage: true,
                  saleEndsAt: true,
                  isPublished: true,
                  deletedAt: true,
                },
              },
            },
          },
        },
      });

      this.logger.log(`Empty cart created for user: ${userId}`);
    }

    // Filter out unavailable products
    const validItems = cart.items.filter(
      (item) => item.product.isPublished && !item.product.deletedAt,
    );

    // Calculate subtotal
    const subtotal = validItems.reduce((sum, item) => {
      return sum + Number(item.priceAtAdd);
    }, 0);

    // Get discount code if applied
    const discountCodeKey = `${this.CART_PREFIX}${userId}:discount`;
    const discountCode = await this.cacheManager.get<string>(discountCodeKey);

    let discountAmount = 0;
    if (discountCode) {
      const discount = await this.prisma.discountCode.findUnique({
        where: { code: discountCode },
      });

      if (discount && discount.isActive) {
        discountAmount = this.calculateDiscount(
          subtotal,
          discount.discountType,
          Number(discount.discountValue),
          discount.maxDiscount ? Number(discount.maxDiscount) : null,
        );
      }
    }

    const total = Math.max(0, subtotal - discountAmount);
    return {
      id: cart.id,
      userId: cart.userId,
      items: validItems.map((item) => ({
        id: item.id,
        productId: item.product.id,
        productTitle: item.product.title,
        productSlug: item.product.slug,
        coverImage: item.product.coverImage,
        priceAtAdd: Number(item.priceAtAdd),
        currentPrice: Number(item.product.price),
        currentDiscount: item.product.discountPercentage,
      })),
      subtotal,
      discountCode: discountCode || null,
      discountAmount,
      total,
      itemCount: validItems.length, // Count of items, not quantity
      expiresAt: cart.expiresAt,
      updatedAt: cart.updatedAt,
    };
  }

  private calculateDiscount(
    subtotal: number,
    type: 'PERCENTAGE' | 'FIXED_AMOUNT',
    value: number,
    maxDiscount: number | null,
  ): number {
    let discount = 0;

    if (type === 'PERCENTAGE') {
      discount = (subtotal * value) / 100;
      if (maxDiscount && discount > maxDiscount) {
        discount = maxDiscount;
      }
    } else {
      discount = value;
    }

    return Math.min(discount, subtotal); // Don't discount more than subtotal
  }

  private async invalidateCache(userId: string): Promise<void> {
    const cacheKey = `${this.CART_PREFIX}${userId}`;
    await this.cacheManager.del(cacheKey);
  }
}
