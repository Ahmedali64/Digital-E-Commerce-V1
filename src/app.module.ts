import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from './common/logger/logger.module';
import { MailModule } from './modules/mail/mail.module';
import { UsersModule } from './modules/users/users.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ProductsModule } from './modules/products/products.module';
import { FilesModule } from './modules/files/files.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ScheduleTasksModule } from './modules/schedule-tasks/schedule-tasks.module';
import { CartModule } from './modules/cart/cart.module';
import { CacheModule } from '@nestjs/cache-manager';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentModule } from './modules/payment/payment.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([
      {
        ttl: 60, // time window in seconds
        limit: 10, // max requests per window per "tracker" (usually IP)
      },
    ]),
    ScheduleModule.forRoot(),
    CacheModule.register({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    LoggerModule,
    MailModule,
    UsersModule,
    CategoriesModule,
    ProductsModule,
    FilesModule,
    ScheduleTasksModule,
    CartModule,
    OrdersModule,
    PaymentModule,
    WebhooksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
