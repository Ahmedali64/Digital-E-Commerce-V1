/*
  Warnings:

  - Added the required column `firstName` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `user` ADD COLUMN `emailVerifiedAt` DATETIME(3) NULL,
    ADD COLUMN `firstName` VARCHAR(191) NOT NULL,
    ADD COLUMN `isEmailVerified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `lastName` VARCHAR(191) NOT NULL;
