import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { createMailTransporter } from 'src/config/mail.config';
import { Order, OrderItem } from '@prisma/client';
import { formatError } from 'src/common/utils/error.util';

type OrderWithRelations = Order & {
  items: OrderItem[];
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
  payment?: {
    paymobTransactionId?: string | null;
  } | null;
};

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  constructor(private configService: ConfigService) {
    this.transporter = createMailTransporter(this.configService);
  }
  private logger = new Logger(MailService.name);
  async sendVerificationEmail(
    email: string,
    token: string,
    firstName: string,
  ): Promise<void> {
    this.logger.log(
      `Sending email verification process has been started for ${email}`,
    );
    // This is what we will send to the user in the email
    const verificationUrl = `${this.configService.get('FRONTEND_URL')}/auth/verify-email?token=${token}`;

    // Load and compile the template
    // const templatePath = path.join(
    //   process.cwd(),
    //   'src/modules/mail/templates/email-verification.hbs',
    // );
    const templatePath = path.join(
      process.cwd(),
      'dist/src/modules/mail/templates/email-verification.hbs',
    );
    try {
      const templateSource = fs.readFileSync(templatePath, 'utf-8');
      const template = handlebars.compile(templateSource);
      // Generate HTML with data
      const html = template({
        name: firstName,
        verificationUrl: verificationUrl,
      });

      Logger.log('Email template generated successfully');

      // Send the email
      await this.transporter.sendMail({
        from: `"Degital-E-Commerce-Member" <${this.configService.get('MAIL_FROM')}>`,
        to: email,
        subject: 'Verify Your Email Address',
        html: html,
      });
      this.logger.log(`verification email has been sent successfully`);
    } catch (error) {
      const { message, stack } = formatError(error);
      this.logger.error(
        `An error occured while sending verification email Message: ${message}, Stack: ${stack} `,
      );
      throw new InternalServerErrorException(
        'An error occured while sending verification email',
      );
    }
  }

  async sendPasswordResetEmail(
    email: string,
    token: string,
    firstName: string,
  ): Promise<void> {
    this.logger.log(
      `Sending password reset email process has been started for ${email}`,
    );
    const resetUrl = `${this.configService.get('FRONTEND_URL')}/auth/reset-password?token=${token}`;

    const templatePath = path.join(
      process.cwd(),
      'dist/src/modules/mail/templates/password-reset.hbs',
    );
    try {
      const templateSource = fs.readFileSync(templatePath, 'utf-8');
      // We have 2 vars in the template this make the template a func that accept these vars
      const template = handlebars.compile(templateSource);

      const html = template({
        name: firstName,
        resetUrl: resetUrl,
      });

      Logger.log('Email template generated successfully');

      await this.transporter.sendMail({
        from: `"Degital-E-Commerce-Member" <${this.configService.get('MAIL_FROM')}>`,
        to: email,
        subject: 'Reset Your Password',
        html: html,
      });
      this.logger.log(`Password reset email has been sent successfully`);
    } catch (error) {
      const { message, stack } = formatError(error);
      this.logger.error(
        `An error occured while sending Password reset email Message: ${message}, Stack: ${stack} `,
      );
      throw new InternalServerErrorException(
        'An error occured while sending Password reset email',
      );
    }
  }

  async sendPaymentReceiptEmail(order: OrderWithRelations): Promise<void> {
    this.logger.log(
      `Sending payment receipt email process has been started for ${order.id}`,
    );
    // temp file path
    const templatePath = path.join(
      process.cwd(),
      'dist/src/modules/mail/templates/payment-receipt.hbs',
    );

    try {
      // Read temp file
      const templateSource = fs.readFileSync(templatePath, 'utf-8');
      const template = handlebars.compile(templateSource);

      const html = template({
        name: order.user.firstName,
        orderId: order.id,
        orderDate: new Date(order.paidAt || order.createdAt).toLocaleDateString(
          'en-US',
          {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          },
        ),
        transactionId: order.payment?.paymobTransactionId,
        items: order.items.map((item) => ({
          title: item.title,
          authorName: item.authorName,
          price: Number(item.price).toFixed(2),
        })),
        subtotal: Number(order.subtotal).toFixed(2),
        discount: Number(order.discountAmount).toFixed(2),
        discountCode: order.discountCodeUsed,
        total: Number(order.total).toFixed(2),
        downloadUrl: `${this.configService.get('FRONTEND_URL')}/orders/${order.id}`,
        myOrdersUrl: `${this.configService.get('FRONTEND_URL')}/orders`,
      });
      Logger.log('Email template generated successfully');
      await this.transporter.sendMail({
        from: `"Digital E-Commerce" <${this.configService.get('MAIL_FROM')}>`,
        to: order.user.email,
        subject: `Payment Receipt - Order #${order.id.slice(0, 8)}`,
        html: html,
      });
      this.logger.log(`payment receipt email has been sent successfully`);
    } catch (error) {
      const { message, stack } = formatError(error);
      this.logger.error(
        `Failed to send payment receipt email Message: ${message}, Stack: ${stack} `,
      );
      throw new InternalServerErrorException(
        'Failed to send payment receipt email',
      );
    }
  }
}
