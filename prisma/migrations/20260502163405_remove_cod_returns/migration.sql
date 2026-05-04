/*
  Warnings:

  - You are about to drop the column `payment_method` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the `ReturnRequest` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ReturnRequest" DROP CONSTRAINT "ReturnRequest_order_id_fkey";

-- DropForeignKey
ALTER TABLE "ReturnRequest" DROP CONSTRAINT "ReturnRequest_user_id_fkey";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "payment_method";

-- DropTable
DROP TABLE "ReturnRequest";

-- DropEnum
DROP TYPE "ReturnStatus";
