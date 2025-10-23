/*
  Warnings:

  - You are about to alter the column `provider` on the `user` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(2))` to `VarChar(191)`.
  - A unique constraint covering the columns `[slug]` on the table `products` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `products` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `categories` ADD COLUMN `imageOriginal` VARCHAR(191) NULL,
    ADD COLUMN `imageSize` INTEGER NULL;

-- AlterTable
ALTER TABLE `products` ADD COLUMN `coverImageOriginal` VARCHAR(191) NULL,
    ADD COLUMN `coverImageSize` INTEGER NULL,
    ADD COLUMN `pdfFileOriginal` VARCHAR(191) NULL,
    ADD COLUMN `pdfFileSize` INTEGER NULL,
    ADD COLUMN `slug` VARCHAR(191) NOT NULL,
    MODIFY `description` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `user` MODIFY `provider` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `products_slug_key` ON `products`(`slug`);

-- CreateIndex
CREATE INDEX `products_saleEndsAt_idx` ON `products`(`saleEndsAt`);

-- CreateIndex
CREATE INDEX `products_isPublished_deletedAt_idx` ON `products`(`isPublished`, `deletedAt`);

-- CreateIndex
CREATE INDEX `products_deletedAt_idx` ON `products`(`deletedAt`);

-- CreateIndex
CREATE INDEX `products_categoryId_isPublished_idx` ON `products`(`categoryId`, `isPublished`);
