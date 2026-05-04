-- CreateTable
CREATE TABLE "InstaLive" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "instagram_url" TEXT NOT NULL,
    "thumbnail" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstaLive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstaLiveProduct" (
    "id" TEXT NOT NULL,
    "insta_live_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,

    CONSTRAINT "InstaLiveProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstaLiveProduct_insta_live_id_product_id_key" ON "InstaLiveProduct"("insta_live_id", "product_id");

-- AddForeignKey
ALTER TABLE "InstaLiveProduct" ADD CONSTRAINT "InstaLiveProduct_insta_live_id_fkey" FOREIGN KEY ("insta_live_id") REFERENCES "InstaLive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstaLiveProduct" ADD CONSTRAINT "InstaLiveProduct_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
