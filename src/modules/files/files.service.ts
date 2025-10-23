import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';

export enum FileType {
  IMAGE = 'image',
  PDF = 'pdf',
}

export interface UploadResult {
  filename: string;
  path: string;
  url: string;
  size: number;
  mimetype: string;
}

@Injectable()
export class FilesService implements OnModuleInit {
  private readonly logger = new Logger(FilesService.name);
  private readonly uploadDir: string;
  private readonly baseUrl: string;
  // Maximum file sizes (in bytes)
  private readonly MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly MAX_PDF_SIZE = 50 * 1024 * 1024; // 50MB

  // Allowed MIME types
  private readonly ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];
  private readonly ALLOWED_PDF_TYPES = ['application/pdf'];
  constructor(private configService: ConfigService) {
    this.uploadDir = this.configService.get('UPLOAD_DIR') || './uploads';
    this.baseUrl =
      this.configService.get('BASE_URL') || 'http://localhost:3000';
  }

  async onModuleInit() {
    await this.initializeDirectories();
  }

  private async initializeDirectories() {
    const dirs = [
      path.join(this.uploadDir, 'products', 'covers'),
      path.join(this.uploadDir, 'products', 'pdfs'),
      path.join(this.uploadDir, 'categories'),
    ];

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
        this.logger.log(`Directory created/verified: ${dir}`);
      } catch (error) {
        this.logger.error(`Failed to create directory: ${dir}`, error);
      }
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    fileType: FileType,
    subfolder: string,
  ): Promise<UploadResult> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    this.validateFile(file, fileType);

    // Generate unique filename
    const ext = this.getFileExtension(file.originalname);
    const filename = `${randomUUID()}${ext}`;
    const filePath = path.join(this.uploadDir, subfolder, filename);
    const relativePath = `/${subfolder}/${filename}`;

    try {
      await fs.writeFile(filePath, file.buffer);
      this.logger.log(
        `File uploaded: ${filename} (${this.formatBytes(file.size)})`,
      );
      return {
        filename,
        path: relativePath,
        url: `${this.baseUrl}${relativePath}`,
        size: file.size,
        mimetype: file.mimetype,
      };
    } catch (error) {
      this.logger.error(`File upload failed: ${filename}`, error);
      throw new BadRequestException('Failed to upload file');
    }
  }

  async uploadProductCover(file: Express.Multer.File): Promise<UploadResult> {
    return this.uploadFile(file, FileType.IMAGE, 'products/covers');
  }

  async uploadProductPDF(file: Express.Multer.File): Promise<UploadResult> {
    return this.uploadFile(file, FileType.PDF, 'products/pdfs');
  }

  async uploadCategoryImage(file: Express.Multer.File): Promise<UploadResult> {
    return this.uploadFile(file, FileType.IMAGE, 'categories');
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      const fullPath = path.join(this.uploadDir, filePath);
      await fs.unlink(fullPath);
      this.logger.log(`File deleted: ${filePath}`);
    } catch (error) {
      // Don't throw error if file doesn't exist
      this.logger.warn(`Failed to delete file: ${filePath}`, error);
    }
  }

  // Validate file Type + Size
  private validateFile(file: Express.Multer.File, fileType: FileType): void {
    // Type check
    const allowedTypes =
      fileType === FileType.IMAGE
        ? this.ALLOWED_IMAGE_TYPES
        : this.ALLOWED_PDF_TYPES;
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
      );
    }

    // Size check
    const maxSize =
      fileType === FileType.IMAGE ? this.MAX_IMAGE_SIZE : this.MAX_PDF_SIZE;

    if (file.size > maxSize) {
      throw new BadRequestException(
        `File too large. Maximum size: ${this.formatBytes(maxSize)}`,
      );
    }
  }

  // Format bytes to human readable format
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  private getFileExtension(filename: string): string {
    // Return part after . if no . return empty string
    const ext = path.extname(filename).toLowerCase();
    if (!ext) {
      throw new BadRequestException('File must have an extension');
    }
    return ext;
  }
}
