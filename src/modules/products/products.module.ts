import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { FilesModule } from '../files/files.module';

@Module({
  providers: [ProductsService],
  controllers: [ProductsController],
  imports: [FilesModule],
})
export class ProductsModule {}
