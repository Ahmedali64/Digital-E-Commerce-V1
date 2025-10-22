import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { createMailTransporter } from 'src/config/mail.config';

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
}
