import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateOrderDto, OrderResponseDto } from './dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ErrorResponseDto } from 'src/common/dto';
import { GetUser } from 'src/common/decorators/get-user.decorator';

@Controller('orders')
@ApiTags('Orders')
@UseGuards(JwtAuthGuard) // All routes require authentication
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create order from cart and initiate payment' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Order created successfully, payment URL returned',
    // We'll update this after Paymob integration
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cart is empty or invalid discount code',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
    type: ErrorResponseDto,
  })
  async createOrder(
    @GetUser('id') userId: string,
    @Body() dto: CreateOrderDto,
  ) {
    const order = await this.ordersService.createOrder(userId, dto);

    // TODO: After we add Paymob, we'll return payment URL here
    return {
      message: 'Order created successfully',
      order,
      // paymentUrl: '...' // Will add this next
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all orders for current user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Orders retrieved successfully',
    type: [OrderResponseDto],
  })
  async getUserOrders(
    @GetUser('id') userId: string,
  ): Promise<OrderResponseDto[]> {
    return this.ordersService.getUserOrders(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single order by ID' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Order retrieved successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Order not found',
    type: ErrorResponseDto,
  })
  async getOrderById(
    @GetUser('id') userId: string,
    @Param('id') orderId: string,
  ): Promise<OrderResponseDto> {
    return this.ordersService.getOrderById(orderId, userId);
  }
}
