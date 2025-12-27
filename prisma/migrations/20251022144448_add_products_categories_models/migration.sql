/*
  Warnings:

  - You are about to alter the column `provider` on the `user` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(1))`.

*/
-- AlterTable
ALTER TABLE `User` MODIFY `provider` ENUM('LOCAL', 'GOOGLE', 'GITHUB') NULL;

-- CreateTable
CREATE TABLE `products` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `authorName` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `isbn` VARCHAR(191) NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `discountPercentage` INTEGER NULL,
    `saleEndsAt` DATETIME(3) NULL,
    `coverImage` VARCHAR(191) NOT NULL,
    `pdfFile` VARCHAR(191) NOT NULL,
    `pageCount` INTEGER NULL,
    `language` ENUM('ENGLISH', 'ARABIC', 'FRENCH', 'SPANISH', 'GERMAN', 'OTHER') NOT NULL DEFAULT 'ENGLISH',
    `isPublished` BOOLEAN NOT NULL,
    `publishedAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,
    `publishedYear` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `products_isbn_key`(`isbn`),
    INDEX `products_title_idx`(`title`),
    INDEX `products_authorName_idx`(`authorName`),
    INDEX `products_categoryId_idx`(`categoryId`),
    INDEX `products_isPublished_idx`(`isPublished`),
    INDEX `products_price_idx`(`price`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `image` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `categories_name_key`(`name`),
    UNIQUE INDEX `categories_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
