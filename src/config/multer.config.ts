import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';

export const MulterConfig: MulterOptions = {
  // Save file in memory so we can process it before saving
  storage: memoryStorage(),
  fileFilter(req, file, callback) {
    // Allowed image types and pdf
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(
        new BadRequestException(
          `Unsupported file type: ${file.mimetype}. Allowed types: images (jpg, png, webp) and PDF`,
        ),
        false,
      );
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
};
