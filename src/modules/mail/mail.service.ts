import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { createMailTransporter } from 'src/config/mail.config';
import { Order, OrderItem } from '@prisma/client';

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

  async sendVerificationEmail(
    email: string,
    token: string,
    firstName: string,
  ): Promise<void> {
    // This is what we will send to the user in the email
    const verificationUrl = `${this.configService.get('FRONTEND_URL')}/auth/verify-email?token=${token}`;

    // Load and compile the template
    const templatePath = path.join(
      process.cwd(),
      'src/modules/mail/templates/email-verification.hbs',
    );
    try {
      const templateSource = fs.readFileSync(templatePath, 'utf-8');
      const template = handlebars.compile(templateSource);
      // Generate HTML with data
      const html = template({
        name: firstName,
        verificationUrl: verificationUrl,
      });

      // Send the email
      await this.transporter.sendMail({
        from: `"Degital-E-Commerce-Member" <${this.configService.get('MAIL_FROM')}>`,
        to: email,
        subject: 'Verify Your Email Address',
        html: html,
      });
    } catch (error) {
      console.log(
        '[mail.service] - An error occured while sending verification email',
      );
      throw error;
    }
  }

  async sendPasswordResetEmail(
    email: string,
    token: string,
    firstName: string,
  ): Promise<void> {
    const resetUrl = `${this.configService.get('FRONTEND_URL')}/auth/reset-password?token=${token}`;

    const templatePath = path.join(
      process.cwd(),
      'src/modules/mail/templates/password-reset.hbs',
    );
    try {
      const templateSource = fs.readFileSync(templatePath, 'utf-8');
      // We have 2 vars in the template this make the template a func that accept these vars
      const template = handlebars.compile(templateSource);

      const html = template({
        name: firstName,
        resetUrl: resetUrl,
      });

      await this.transporter.sendMail({
        from: `"Degital-E-Commerce-Member" <${this.configService.get('MAIL_FROM')}>`,
        to: email,
        subject: 'Reset Your Password',
        html: html,
      });
    } catch (error) {
      console.log(
        '[mail.service] - An error occured while sending Password reset email',
      );
      throw error;
    }
  }

  async sendPaymentReceiptEmail(order: OrderWithRelations): Promise<void> {
    // temp file path
    const templatePath = path.join(
      process.cwd(),
      'src/modules/mail/templates/payment-receipt.hbs',
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

      await this.transporter.sendMail({
        from: `"Digital E-Commerce" <${this.configService.get('MAIL_FROM')}>`,
        to: order.user.email,
        subject: `Payment Receipt - Order #${order.id.slice(0, 8)}`,
        html: html,
      });
    } catch (error) {
      console.error(
        '[MailService] Failed to send payment receipt email',
        error,
      );
      throw error;
    }
  }
}
