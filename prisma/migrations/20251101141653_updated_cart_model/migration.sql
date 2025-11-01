/*
  Warnings:

  - You are about to drop the column `quantity` on the `cart_items` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `cart_items` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `cart_items` DROP COLUMN `quantity`,
    DROP COLUMN `updatedAt`;
