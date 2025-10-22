import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Profile as GoogleProfile } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID')!,
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET')!,
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL')!,
      scope: ['email', 'profile'],
    });
  }
  // Passport calls this AFTER successfully getting user info from Google
  validate(
    accessToken: string,
    refreshToken: string,
    profile: GoogleProfile,
    // This var is just to tell passport we are done after we finish our logic
    done: VerifyCallback,
  ): void {
    const { id, name, emails, photos } = profile;
    const user = {
      provider: 'google',
      providerId: id,
      email: emails?.[0]?.value ?? '',
      firstName: name?.givenName ?? '',
      lastName: name?.familyName ?? '',
      avatar: photos?.[0]?.value ?? '',
    };
    // Attach user to req.user
    done(null, user);
  }
}
