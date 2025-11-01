import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDiscountCodeDto } from './dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class DiscountService {
  private readonly logger = new Logger(DiscountService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create discount code (Admin)
   */
  async create(dto: CreateDiscountCodeDto) {
    this.logger.log(`Creating discount code: ${dto.code}`);

    if (dto.discountType === 'PERCENTAGE' && dto.discountValue > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100%');
    }

    const existing = await this.prisma.discountCode.findUnique({
      where: { code: dto.code.toUpperCase() },
    });

    if (existing) {
      throw new ConflictException('Discount code already exists');
    }

    try {
      const discountCode = await this.prisma.discountCode.create({
        data: {
          ...dto,
          code: dto.code.toUpperCase(),
        },
      });

      this.logger.log(`Discount code created: ${discountCode.code}`);

      return {
        message: 'Discount code created successfully',
        discountCode,
      };
    } catch (error) {
      this.logger.error('Failed to create discount code', error);
      throw error;
    }
  }

  /**
   * Get all discount codes (Admin)
   */
  async findAll() {
    return this.prisma.discountCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { usages: true },
        },
      },
    });
  }

  /**
   * Get single discount code (Admin)
   */
  async findOne(id: string) {
    const discountCode = await this.prisma.discountCode.findUnique({
      where: { id },
      include: {
        usages: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { usedAt: 'desc' },
        },
      },
    });

    if (!discountCode) {
      throw new NotFoundException('Discount code not found');
    }

    return discountCode;
  }

  /**
   * Update discount code (Admin)
   */
  async update(id: string, dto: Partial<CreateDiscountCodeDto>) {
    this.logger.log(`Updating discount code: ${id}`);

    const existing = await this.prisma.discountCode.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Discount code not found');
    }

    if (
      dto.discountType === 'PERCENTAGE' &&
      dto.discountValue &&
      dto.discountValue > 100
    ) {
      throw new BadRequestException('Percentage discount cannot exceed 100%');
    }

    try {
      const discountCode = await this.prisma.discountCode.update({
        where: { id },
        data: {
          ...dto,
          code: dto.code ? dto.code.toUpperCase() : undefined,
        },
      });

      this.logger.log(`Discount code updated: ${id}`);

      return {
        message: 'Discount code updated successfully',
        discountCode,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Discount code already exists');
        }
      }
      this.logger.error('Failed to update discount code', error);
      throw error;
    }
  }

  /**
   * Deactivate discount code (Admin)
   */
  async deactivate(id: string) {
    this.logger.log(`Deactivating discount code: ${id}`);

    const discountCode = await this.prisma.discountCode.findUnique({
      where: { id },
    });

    if (!discountCode) {
      throw new NotFoundException('Discount code not found');
    }

    await this.prisma.discountCode.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(`Discount code deactivated: ${id}`);

    return {
      message: 'Discount code deactivated successfully',
    };
  }

  /**
   * Activate discount code (Admin)
   */
  async activate(id: string) {
    this.logger.log(`Activating discount code: ${id}`);

    const discountCode = await this.prisma.discountCode.findUnique({
      where: { id },
    });

    if (!discountCode) {
      throw new NotFoundException('Discount code not found');
    }

    await this.prisma.discountCode.update({
      where: { id },
      data: { isActive: true },
    });

    this.logger.log(`Discount code activated: ${id}`);

    return {
      message: 'Discount code activated successfully',
    };
  }

  /**
   * Delete discount code (Admin)
   */
  async remove(id: string) {
    this.logger.log(`Deleting discount code: ${id}`);

    const discountCode = await this.prisma.discountCode.findUnique({
      where: { id },
      include: {
        _count: {
          select: { usages: true },
        },
      },
    });

    if (!discountCode) {
      throw new NotFoundException('Discount code not found');
    }

    // Warn if code has been used
    if (discountCode._count.usages > 0) {
      this.logger.warn(
        `Deleting discount code that has been used ${discountCode._count.usages} times`,
      );
    }

    await this.prisma.discountCode.delete({
      where: { id },
    });

    this.logger.log(`Discount code deleted: ${id}`);

    return {
      message: 'Discount code deleted successfully',
    };
  }

  /**
   * Validate discount code (used internally)
   */
  async validateCode(code: string, userId: string, subtotal: number) {
    const discount = await this.prisma.discountCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!discount) {
      return { valid: false, message: 'Invalid discount code' };
    }

    if (!discount.isActive) {
      return { valid: false, message: 'This discount code is not active' };
    }

    // Check expiration
    const now = new Date();
    if (discount.expiresAt && discount.expiresAt < now) {
      return { valid: false, message: 'This discount code has expired' };
    }

    if (discount.startsAt && discount.startsAt > now) {
      return { valid: false, message: 'This discount code is not yet valid' };
    }

    // Check usage limit
    if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
      return {
        valid: false,
        message: 'This discount code has reached its usage limit',
      };
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
        return {
          valid: false,
          message:
            'You have already used this discount code the maximum number of times',
        };
      }
    }

    // Check minimum purchase
    if (discount.minPurchase && subtotal < Number(discount.minPurchase)) {
      return {
        valid: false,
        message: `Minimum purchase of ${discount.minPurchase.toString()} required`,
      };
    }

    return { valid: true, discount };
  }

  /**
   * Record discount usage (called when order is created)
   */
  async recordUsage(discountCodeId: string, userId: string, orderId?: string) {
    // Create usage record
    await this.prisma.discountUsage.create({
      data: {
        discountCodeId,
        userId,
        orderId,
      },
    });

    // Increment usage count
    await this.prisma.discountCode.update({
      where: { id: discountCodeId },
      data: {
        usageCount: {
          increment: 1,
        },
      },
    });

    this.logger.log(`Discount usage recorded for user: ${userId}`);
  }
}
