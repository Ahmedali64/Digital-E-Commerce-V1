import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailModule } from '../mail/mail.module';
import { EmailConsumer } from './consumers/email.consumer';

@Module({
  providers: [QueueService],
  imports: [
    ConfigModule, // We have to import the module first
    MailModule,
    ClientsModule.registerAsync([
      {
        name: 'EMAIL_SERVICE', // This name is what will hold the return value of the useFactory as a key in the nest DI container
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              configService.get<string>(
                'RABBITMQ_URL',
                'amqp://localhost:5672',
              ),
            ],
            queue: configService.get<string>('RABBITMQ_QUEUE', 'email_queue'),
            queueOptions: {
              durable: true,
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  exports: [QueueService],
  controllers: [EmailConsumer],
})
export class QueueModule {}
