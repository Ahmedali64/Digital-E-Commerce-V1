import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpStatus,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CartService } from './cart.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { AddToCartDto, ApplyDiscountDto, CartDto } from './dto';
import { ErrorResponseDto } from 'src/common/dto';
import type { AuthenticatedRequest } from 'src/common/types/authenticated-request.type';

@Controller('cart')
@ApiTags('Shopping Cart')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user cart' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cart retrieved successfully',
    type: CartDto,
  })
  async getCart(@Request() req: AuthenticatedRequest): Promise<CartDto> {
    return this.cartService.getCart(req.user.id);
  }

  @Post('items')
  @ApiOperation({ summary: 'Add book to cart (digital product - no quantity)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Book added to cart',
    type: CartDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product not found',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Product already in cart',
    type: ErrorResponseDto,
  })
  async addItem(
    @Request() req: AuthenticatedRequest,
    @Body() addToCartDto: AddToCartDto,
  ): Promise<CartDto> {
    return this.cartService.addItem(req.user.id, addToCartDto.productId);
  }

  @Delete('items/:productId')
  @ApiOperation({ summary: 'Remove book from cart' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Book removed from cart',
    type: CartDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Cart or item not found',
    type: ErrorResponseDto,
  })
  async removeItem(
    @Request() req: AuthenticatedRequest,
    @Param('productId') productId: string,
  ): Promise<CartDto> {
    return this.cartService.removeItem(req.user.id, productId);
  }

  @Delete()
  @ApiOperation({ summary: 'Clear entire cart' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cart cleared successfully',
    schema: {
      example: {
        message: 'Cart cleared successfully',
      },
    },
  })
  async clearCart(@Request() req: AuthenticatedRequest) {
    await this.cartService.clearCart(req.user.id);
    return {
      message: 'Cart cleared successfully',
    };
  }

  @Post('discount')
  @ApiOperation({ summary: 'Apply discount code to cart' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Discount code applied',
    type: CartDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invalid discount code',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Discount code expired or usage limit reached',
    type: ErrorResponseDto,
  })
  async applyDiscount(
    @Request() req: AuthenticatedRequest,
    @Body() applyDiscountDto: ApplyDiscountDto,
  ): Promise<CartDto> {
    return this.cartService.applyDiscount(req.user.id, applyDiscountDto.code);
  }

  @Delete('discount')
  @ApiOperation({ summary: 'Remove discount code from cart' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Discount code removed',
    type: CartDto,
  })
  async removeDiscount(@Request() req: AuthenticatedRequest): Promise<CartDto> {
    return this.cartService.removeDiscount(req.user.id);
  }
}
