import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Category, Prisma } from '@prisma/client';
import slugify from 'slugify';
import { formatError } from 'src/common/utils/error.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';
import { FilesService, UploadResult } from '../files/files.service';

interface CategoryWithProductCount extends Category {
  _count: { products: number };
}

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);
  constructor(
    private prisma: PrismaService,
    private readonly fileUploadService: FilesService,
  ) {}
  async create(dto: CreateCategoryDto, file: { image: Express.Multer.File[] }) {
    this.logger.log(`Category creation attempt: ${dto.name}`);
    if (!file?.image) {
      throw new BadRequestException('Cover image is required');
    }

    // Auto-generate slug from name
    const slug = slugify(dto.name, {
      lower: true,
      strict: true,
      trim: true,
    });

    const existingSlug = await this.prisma.category.findUnique({
      where: { slug },
    });

    if (existingSlug) {
      this.logger.warn(`Duplicate category slug: ${slug}`);
      throw new ConflictException(
        `A category with name "${dto.name}" already exists`,
      );
    }

    let coverImagePath: string;
    let coverResult: UploadResult | undefined;
    try {
      coverResult = await this.fileUploadService.uploadCategoryImage(
        file.image[0],
      );
      coverImagePath = coverResult.path;

      this.logger.log(`File uploaded: Cover=${coverImagePath}`);
    } catch (error: unknown) {
      const { message, stack } = formatError(error);
      this.logger.error(
        `Error while uploading category image for "${dto.name}": ${message}`,
        stack,
      );
      throw new InternalServerErrorException('File upload failed');
    }

    try {
      const category = await this.prisma.category.create({
        data: {
          ...dto,
          slug,
          image: coverResult.path,
          imageSize: coverResult.size,
          imageOriginal: file.image[0].originalname,
        },
      });

      this.logger.log(
        `Category created: ID=${category.id}, Name="${category.name}"`,
      );

      return {
        message: 'Category created successfully',
        category,
      };
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const target = (error.meta?.target as string[]) || [];

          if (target.includes('name')) {
            throw new ConflictException('Category name already exists');
          }
          if (target.includes('slug')) {
            throw new ConflictException('Category slug already exists');
          }
        }
      }

      const { message, stack } = formatError(error);
      this.logger.error(
        `Category creation failed: ${dto.name}, message: ${message}`,
        stack,
      );

      throw new InternalServerErrorException(
        'Failed to create category. Please try again.',
      );
    }
  }

  async findAll(includeCount = false) {
    this.logger.log('Fetching all categories');

    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      ...(includeCount && {
        include: {
          _count: {
            select: {
              products: {
                where: {
                  deletedAt: null,
                  isPublished: true,
                },
              },
            },
          },
        },
      }),
    });

    // Transform to include product count if requested (more frontend friendly)
    /**
     * Return will be
     * {
     *  ...category => (normal category fields)
     *  productCount => number of products per category
     * }
     */
    if (includeCount) {
      return categories.map((cat: CategoryWithProductCount) => ({
        ...cat,
        productCount: cat._count?.products || 0,
        _count: undefined,
      }));
    }

    return categories;
  }

  async findOne(identifier: string) {
    this.logger.log(`Fetching category: ${identifier}`);

    const category = await this.prisma.category.findFirst({
      where: {
        OR: [{ id: identifier }, { slug: identifier }],
      },
    });

    if (!category) {
      this.logger.warn(`Category not found: ${identifier}`);
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async findOneWithProducts(identifier: string) {
    this.logger.log(`Fetching category with products: ${identifier}`);

    const category = await this.prisma.category.findFirst({
      where: {
        OR: [{ id: identifier }, { slug: identifier }],
      },
      include: {
        products: {
          where: {
            deletedAt: null,
            isPublished: true,
          },
          select: {
            id: true,
            title: true,
            slug: true,
            authorName: true,
            price: true,
            discountPercentage: true,
            coverImage: true,
            isPublished: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return {
      ...category,
      productCount: category.products.length,
    };
  }

  async update(
    id: string,
    dto: UpdateCategoryDto,
    file?: { image: Express.Multer.File[] },
  ) {
    this.logger.log(`Update attempt for category: ${id}`);

    const existing = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    let coverResult: UploadResult | undefined;
    try {
      if (file?.image?.[0]) {
        coverResult = await this.fileUploadService.uploadCategoryImage(
          file.image[0],
        );
      }
    } catch (error: unknown) {
      const { message, stack } = formatError(error);
      this.logger.error(`File upload failed during update: ${message}`, stack);
      throw new InternalServerErrorException('Error while updating the files');
    }

    // If updating name, regenerate slug
    let slug: string | undefined;
    if (dto.name && dto.name !== existing.name) {
      slug = slugify(dto.name, {
        lower: true,
        strict: true,
        trim: true,
      });

      // Check if new slug conflicts
      const slugExists = await this.prisma.category.findFirst({
        where: {
          slug,
          id: { not: id },
        },
      });

      if (slugExists) {
        throw new ConflictException('A category with this name already exists');
      }
    }

    try {
      const category = await this.prisma.category.update({
        where: { id },
        data: {
          ...dto,
          ...(slug && { slug }),
          ...(coverResult && {
            image: coverResult.path,
            imageSize: coverResult.size,
            imageOriginal: file?.image?.[0]?.originalname,
          }),
        },
      });

      if (coverResult && existing.image) {
        await this.fileUploadService.deleteFile(existing.image);
      }

      this.logger.log(`Category updated: ID=${id}`);

      return {
        message: 'Category updated successfully',
        category,
      };
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Category name already exists');
        }
      }

      this.logger.error(`Category update failed: ${id}`, error);
      throw error;
    }
  }

  async remove(id: string) {
    this.logger.log(`Delete attempt for category: ${id}`);

    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: { where: { deletedAt: null } } },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Check if category has products
    if (category._count.products > 0) {
      this.logger.warn(
        `Cannot delete category ${id}: has ${category._count.products} products`,
      );
      throw new BadRequestException(
        `Cannot delete category with existing products. This category has ${category._count.products} product(s).`,
      );
    }

    await this.prisma.category.delete({
      where: { id },
    });

    this.logger.log(`Category deleted: ID=${id}`);

    return {
      message: 'Category deleted successfully',
    };
  }
}
