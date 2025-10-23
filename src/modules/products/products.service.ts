import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { formatError } from 'src/common/utils/error.util';
import slugify from 'slugify';
import {
  CreateProductDto,
  CreateProductResponseDto,
  ProductListResponseDto,
  QueryProductsDto,
  SortBy,
  UpdateProductDto,
} from './dto';
import { FilesService, UploadResult } from '../files/files.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileUploadService: FilesService,
  ) {}

  async createProduct(
    dto: CreateProductDto,
    files: {
      coverImage?: Express.Multer.File[];
      pdfFile?: Express.Multer.File[];
    },
  ): Promise<CreateProductResponseDto> {
    this.logger.log(`Creation attempt for product with title: ${dto.title}`);

    if (!files?.coverImage) {
      throw new BadRequestException('Cover image is required');
    }
    if (!files?.pdfFile) {
      throw new BadRequestException('PDF file is required');
    }

    const categoryExists = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });

    if (!categoryExists) {
      this.logger.warn(`Invalid category ID: ${dto.categoryId}`);
      throw new BadRequestException(
        `Category with ID "${dto.categoryId}" does not exist`,
      );
    }
    // This will generate auto slugs instead of entering it manually to avoid typos
    const slug = slugify(dto.title, {
      lower: true,
      strict: true,
      trim: true,
    });

    // Make sure that the slug is unique
    const existingSlug = await this.prisma.product.findUnique({
      where: { slug },
    });

    if (existingSlug) {
      this.logger.warn(`Slug already exists: ${slug}`);
      throw new ConflictException(
        `A product with a similar title already exists`,
      );
    }

    // Make sure that admin enters a valid Date for the sale end time
    const now = new Date();
    if (dto.saleEndsAt && dto.saleEndsAt <= now) {
      this.logger.warn(
        `Sale end time is not valid. Current Date: ${now.toString()}, SaleEndAt Date: ${dto.saleEndsAt.toString()}`,
      );
      throw new BadRequestException('Sale end time must be bigger than now');
    }

    // To insert a date for sale end time you have to insert a discount first
    if (dto.saleEndsAt && !dto.discountPercentage) {
      this.logger.warn(
        `Not valid discount percentage ${dto.discountPercentage}`,
      );
      throw new BadRequestException(
        'Cannot set sale end date without discount percentage',
      );
    }

    let coverResult: UploadResult | undefined;
    let pdfResult: UploadResult | undefined;

    try {
      coverResult = await this.fileUploadService.uploadProductCover(
        files.coverImage[0],
      );

      pdfResult = await this.fileUploadService.uploadProductPDF(
        files.pdfFile[0],
      );

      this.logger.log(
        `Files uploaded: Cover=${coverResult.path}, PDF=${pdfResult.path}`,
      );
    } catch (error) {
      // We are removing the path not the pdf file path cause if there is an err on the cover it will not make a path and there is no saved file but if there is an err in the pdf upload the cover would be already saved and done so we remove it
      if (coverResult?.path) {
        await this.fileUploadService.deleteFile(coverResult.path);
      }
      const { message, stack } = formatError(error);
      this.logger.error(
        `Error while uploading product files : ${message}`,
        stack,
      );
      throw new InternalServerErrorException('File upload failed');
    }

    // If admin sets product to published we set the publish date to now
    let publishedAt: Date | null = null;
    if (dto.isPublished) {
      this.logger.log(
        `Product: ${dto.title} got published. publish date set to ${now.toString()} `,
      );
      publishedAt = new Date();
    }

    try {
      const product = await this.prisma.product.create({
        data: {
          ...dto,
          slug,
          publishedAt,
          coverImage: coverResult.path,
          coverImageSize: coverResult.size,
          coverImageOriginal: files.coverImage[0].originalname,
          pdfFile: pdfResult.path,
          pdfFileSize: pdfResult.size,
          pdfFileOriginal: files.pdfFile[0].originalname,
        },
        include: {
          category: {
            select: {
              name: true,
              slug: true,
              description: true,
            },
          },
        },
      });
      this.logger.log(
        `Product created: ID=${product.id}, Title="${product.title}"`,
      );
      // Calculate price if there is a discount
      const price = Number(product.price);
      const finalPrice =
        product.discountPercentage && product.discountPercentage > 0
          ? this.calculateFinalPrice(price, product.discountPercentage)
          : price;
      return {
        message: 'Product created successfully',
        product,
        priceAfterDiscount: finalPrice,
      };
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          this.logger.warn(
            `Creation failed - Unique constraint violation (ISBN): ${dto.isbn}`,
          );
          const target = (error.meta?.target as string[]) || [];

          if (target.includes('isbn')) {
            this.logger.warn(`Duplicate ISBN: ${dto.isbn}`);
            throw new ConflictException(
              `A product with ISBN "${dto.isbn}" already exists`,
            );
          }

          if (target.includes('slug')) {
            this.logger.warn(`Duplicate slug: ${slug}`);
            throw new ConflictException(
              `A product with title "${dto.title}" already exists`,
            );
          }
        }
      }

      const { message, stack } = formatError(error);
      this.logger.error(
        `Product creation failed: ${dto.title}: ${message}`,
        stack,
      );
      throw new InternalServerErrorException(
        'Failed to create product. Please try again.',
      );
    }
  }

  async findAll(query: QueryProductsDto): Promise<ProductListResponseDto> {
    this.logger.log(`Getting all products attempt started`);
    const {
      search,
      categoryId,
      minPrice,
      maxPrice,
      language,
      onSale,
      sortBy,
      page = 1,
    } = query;

    // A where clause that we will use to retrieve products with searching and filtering options
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      isPublished: true,
    };

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { authorName: { contains: search } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) {
        where.price.gte = minPrice;
      }
      if (maxPrice !== undefined) {
        where.price.lte = maxPrice;
      }
    }

    if (language) {
      where.language = language;
    }

    if (onSale) {
      where.discountPercentage = { not: null };
      where.saleEndsAt = { gte: new Date() };
    }

    let orderBy: Prisma.ProductOrderByWithRelationInput = {};
    switch (sortBy) {
      case SortBy.NEWEST:
        orderBy = { createdAt: 'desc' };
        break;
      case SortBy.OLDEST:
        orderBy = { createdAt: 'asc' };
        break;
      case SortBy.PRICE_ASC:
        orderBy = { price: 'asc' };
        break;
      case SortBy.PRICE_DESC:
        orderBy = { price: 'desc' };
        break;
      case SortBy.TITLE_ASC:
        orderBy = { title: 'asc' };
        break;
      case SortBy.TITLE_DESC:
        orderBy = { title: 'desc' };
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    const MAX_LIMIT = 100;
    const limit = Math.min(query.limit || 12, MAX_LIMIT);
    const skip = (page - 1) * limit;

    try {
      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: {
            category: {
              select: {
                name: true,
                slug: true,
                description: true,
              },
            },
          },
        }),
        this.prisma.product.count({ where }),
      ]);
      const totalPages = Math.ceil(total / limit);
      this.logger.log(
        `Products fetched: ${products.length}/${total} (page ${page}/${totalPages})`,
      );

      return {
        products,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error: unknown) {
      const { message, stack } = formatError(error);
      this.logger.error(
        `Getting all products failed. Message: ${message}`,
        stack,
      );
      throw new InternalServerErrorException(
        'Failed to fetch all products. Please try again.',
      );
    }
  }

  async findOne(identifier: string) {
    this.logger.log(`Fetching product: ${identifier}`);

    const product = await this.prisma.product.findFirst({
      where: {
        OR: [{ id: identifier }, { slug: identifier }],
        deletedAt: null,
        isPublished: true,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!product) {
      this.logger.warn(`Product not found: ${identifier}`);
      throw new NotFoundException('Product not found');
    }

    // Why did we remove the update from here
    /**
     * Reading a product shouldn't change the database
     * if 1000 users view the product at the same time, you'll do 1000 unnecessary updates
     * So we will just add a condition
     */
    const isSaleActive =
      product.saleEndsAt &&
      product.saleEndsAt > new Date() &&
      product.discountPercentage;

    const price = Number(product.price);
    const finalPrice = product.discountPercentage
      ? this.calculateFinalPrice(price, product.discountPercentage)
      : price;

    return {
      product: {
        ...product,
        // Show null if sale expired
        discountPercentage: isSaleActive ? product.discountPercentage : null,
        saleEndsAt: isSaleActive ? product.saleEndsAt : null,
      },
      priceAfterDiscount: finalPrice,
    };
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    files?: {
      coverImage?: Express.Multer.File[];
      pdfFile?: Express.Multer.File[];
    },
  ) {
    this.logger.log(`Update attempt for product: ${id}`);
    const existing = await this.prisma.product.findUnique({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    let coverResult: UploadResult | undefined;
    let pdfResult: UploadResult | undefined;
    try {
      if (files?.coverImage?.[0]) {
        coverResult = await this.fileUploadService.uploadProductCover(
          files.coverImage[0],
        );
      }

      if (files?.pdfFile?.[0]) {
        pdfResult = await this.fileUploadService.uploadProductPDF(
          files.pdfFile[0],
        );
      }
    } catch (error) {
      const { message, stack } = formatError(error);
      this.logger.error(`File upload failed during update: ${message}`, stack);
      throw new InternalServerErrorException('Error while updating the files');
    }

    // If updating title, regenerate slug
    let slug: string | undefined;
    if (dto.title && dto.title !== existing.title) {
      slug = slugify(dto.title, {
        lower: true,
        strict: true,
        trim: true,
      });

      // Check if new slug conflicts
      const slugExists = await this.prisma.product.findFirst({
        where: {
          slug,
          id: { not: id },
        },
      });

      if (slugExists) {
        // User doesn't know what is a slug so i will just return the title name
        throw new ConflictException('A product with this title already exists');
      }
    }

    // Validate category if provided
    if (dto.categoryId && dto.categoryId !== existing.categoryId) {
      const categoryExists = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });

      if (!categoryExists) {
        this.logger.warn(`Invalid category id: ${dto.categoryId}`);
        throw new BadRequestException('Invalid category ID');
      }
    }

    // Validate sale date
    if (dto.saleEndsAt) {
      const now = new Date();
      if (dto.saleEndsAt <= now) {
        this.logger.warn(
          `Invalid sale ends date Date: ${dto.saleEndsAt.toString()}`,
        );
        throw new BadRequestException('Sale end date must be in the future');
      }
    }

    // Handle publishing logic
    let publishedAt = existing.publishedAt;
    if (dto.isPublished !== undefined) {
      if (dto.isPublished && !existing.publishedAt) {
        // Publishing for first time
        publishedAt = new Date();
      } else if (!dto.isPublished) {
        // Unpublishing - keep publishedAt for history
        publishedAt = existing.publishedAt;
      }
    }

    try {
      const product = await this.prisma.product.update({
        where: { id },
        data: {
          ...dto,
          // If slug has a truthy value the expression slug && { slug } becomes { slug: 'clean-code' } then we spread it with ...
          ...(slug && { slug }),
          publishedAt,
          // update if there is a value for the update results
          ...(coverResult && {
            coverImage: coverResult.path,
            coverImageSize: coverResult.size,
            coverImageOriginal: files?.coverImage?.[0]?.originalname,
          }),
          ...(pdfResult && {
            pdfFile: pdfResult.path,
            pdfFileSize: pdfResult.size,
            pdfFileOriginal: files?.pdfFile?.[0]?.originalname,
          }),
        },
        include: {
          category: {
            select: {
              name: true,
              slug: true,
              description: true,
            },
          },
        },
      });

      if (coverResult && existing.coverImage) {
        await this.fileUploadService.deleteFile(existing.coverImage);
      }
      if (pdfResult && existing.pdfFile) {
        await this.fileUploadService.deleteFile(existing.pdfFile);
      }

      this.logger.log(`Product updated: ID=${id}`);

      const price = Number(product.price);
      const finalPrice = product.discountPercentage
        ? this.calculateFinalPrice(price, product.discountPercentage)
        : price;

      return {
        message: 'Product updated successfully',
        product,
        priceAfterDiscount: finalPrice,
      };
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const target = (error.meta?.target as string[]) || [];
          if (target.includes('isbn')) {
            throw new ConflictException('ISBN already exists');
          }
        }
      }

      this.logger.error(`Product update failed: ${id}`, error);
      throw new InternalServerErrorException(
        'Failed to update product. Please try again.',
      );
    }
  }

  async remove(id: string) {
    this.logger.log(`Delete attempt for product: ${id}`);
    const product = await this.prisma.product.findUnique({
      where: { id, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Soft delete
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Product soft deleted: ID=${id}`);

    return {
      message: 'Product deleted successfully',
    };
  }

  async publish(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.isPublished) {
      throw new BadRequestException('Product is already published');
    }

    await this.prisma.product.update({
      where: { id },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    });

    this.logger.log(`Product published: ID=${id}`);

    return {
      message: 'Product published successfully',
    };
  }

  async unpublish(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (!product.isPublished) {
      throw new BadRequestException('Product is already unpublished');
    }

    await this.prisma.product.update({
      where: { id },
      data: {
        isPublished: false,
        // Keep publishedAt for history
      },
    });

    this.logger.log(`Product unpublished: ID=${id}`);

    return {
      message: 'Product unpublished successfully',
    };
  }
  // Helper functions
  private calculateFinalPrice(price: number, percentage: number): number {
    const discountAmount = (percentage / 100) * price;
    return price - discountAmount;
  }
}
