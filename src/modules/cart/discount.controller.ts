import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { DiscountService } from './discount.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CreateDiscountCodeDto } from './dto';
import { ErrorResponseDto } from 'src/common/dto';

@Controller('admin/discounts')
@ApiTags('Admin - Discount Codes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class DiscountController {
  constructor(private readonly discountService: DiscountService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create discount code (Admin only)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Discount code created successfully',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Discount code already exists',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid discount parameters',
    type: ErrorResponseDto,
  })
  async createDiscountCode(@Body() createDiscountDto: CreateDiscountCodeDto) {
    return this.discountService.create(createDiscountDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all discount codes (Admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Discount codes retrieved successfully',
  })
  async getAllDiscounts() {
    return this.discountService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get discount code details (Admin only)' })
  @ApiParam({ name: 'id', description: 'Discount code ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Discount code details retrieved',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Discount code not found',
    type: ErrorResponseDto,
  })
  async getDiscount(@Param('id') id: string) {
    return this.discountService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update discount code (Admin only)' })
  @ApiParam({ name: 'id', description: 'Discount code ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Discount code updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Discount code not found',
    type: ErrorResponseDto,
  })
  async updateDiscount(
    @Param('id') id: string,
    @Body() updateDiscountDto: Partial<CreateDiscountCodeDto>,
  ) {
    return this.discountService.update(id, updateDiscountDto);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate discount code (Admin only)' })
  @ApiParam({ name: 'id', description: 'Discount code ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Discount code deactivated',
  })
  async deactivateDiscount(@Param('id') id: string) {
    return this.discountService.deactivate(id);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate discount code (Admin only)' })
  @ApiParam({ name: 'id', description: 'Discount code ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Discount code activated',
  })
  async activateDiscount(@Param('id') id: string) {
    return this.discountService.activate(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete discount code (Admin only)' })
  @ApiParam({ name: 'id', description: 'Discount code ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Discount code deleted',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Discount code not found',
    type: ErrorResponseDto,
  })
  async deleteDiscount(@Param('id') id: string) {
    return this.discountService.remove(id);
  }
}
