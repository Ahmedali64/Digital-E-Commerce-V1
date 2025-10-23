import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { FilesModule } from '../files/files.module';

@Module({
  providers: [CategoriesService],
  controllers: [CategoriesController],
  imports: [FilesModule],
})
export class CategoriesModule {}
