import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// To make prisma available in all of our modules without needing to imported in the module everytime
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
