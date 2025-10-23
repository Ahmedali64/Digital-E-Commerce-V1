import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from 'src/common/dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import {
  CreateProductDto,
  CreateProductResponseDto,
  ProductDto,
  ProductListResponseDto,
  QueryProductsDto,
  UpdateProductDto,
} from './dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { MulterConfig } from 'src/config/multer.config';

@Controller('products')
@ApiTags('Products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  // Guards order matter here jwt first then role
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Throttle({ default: { limit: 3, ttl: 300 } })
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'coverImage', maxCount: 1 },
        { name: 'pdfFile', maxCount: 1 },
      ],
      MulterConfig,
    ),
  )
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Product created successfully',
    type: CreateProductResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Not authenticated',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Not authorized (admin only)',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Validation error (invalid input, category, sale date, or discount)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Slug or isbn already exists',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal server error',
    type: ErrorResponseDto,
  })
  async createProduct(
    @Body() dto: CreateProductDto,
    @UploadedFiles()
    files: {
      coverImage: Express.Multer.File[];
      pdfFile: Express.Multer.File[];
    },
  ) {
    return await this.productsService.createProduct(dto, files);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'coverImage', maxCount: 1 },
        { name: 'pdfFile', maxCount: 1 },
      ],
      MulterConfig,
    ),
  )
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update product (Admin only)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product updated successfully',
    type: CreateProductResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product not found',
    type: ErrorResponseDto,
  })
  async updateProduct(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @UploadedFiles()
    files?: {
      coverImage?: Express.Multer.File[];
      pdfFile?: Express.Multer.File[];
    },
  ) {
    return this.productsService.update(id, updateProductDto, files);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete product (Admin only)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product deleted successfully',
    schema: {
      example: {
        message: 'Product deleted successfully',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product not found',
    type: ErrorResponseDto,
  })
  async removeProduct(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
  @Post(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish product (Admin only)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product published successfully',
    schema: {
      example: {
        message: 'Product published successfully',
      },
    },
  })
  async publishProduct(@Param('id') id: string) {
    return this.productsService.publish(id);
  }
  @Post(':id/unpublish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unpublish product (Admin only)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product unpublished successfully',
    schema: {
      example: {
        message: 'Product unpublished successfully',
      },
    },
  })
  async unpublishProduct(@Param('id') id: string) {
    return this.productsService.unpublish(id);
  }

  // Public
  @Get()
  @ApiOperation({ summary: 'Get all published products' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Products retrieved successfully',
    type: ProductListResponseDto,
  })
  async findAllProducts(
    @Query() query: QueryProductsDto,
  ): Promise<ProductListResponseDto> {
    return this.productsService.findAll(query);
  }

  @Get(':identifier')
  @ApiOperation({ summary: 'Get single product by ID or slug' })
  @ApiParam({
    name: 'identifier',
    description: 'Product ID or slug',
    example: 'clean-code',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product retrieved successfully',
    type: ProductDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product not found',
    type: ErrorResponseDto,
  })
  async findOneProduct(@Param('identifier') identifier: string) {
    return this.productsService.findOne(identifier);
  }
}
