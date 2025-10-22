import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export const createMailTransporter = (configService: ConfigService) => {
  return nodemailer.createTransport({
    host: configService.get('MAIL_HOST'),
    port: configService.get('MAIL_PORT'),
    secure: false, // true for 465, false for 587
    auth: {
      user: configService.get('MAIL_USER'),
      pass: configService.get('MAIL_PASSWORD'),
    },
  });
};
