import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '@nestjs/config';
import { Profile as GitHubProfile } from 'passport-github2';
import { VerifyCallback } from 'passport-google-oauth20';
@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private configService: ConfigService) {
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID')!,
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET')!,
      callbackURL: configService.get<string>('GITHUB_CALLBACK_URL')!,
      scope: ['user:email'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: GitHubProfile,
    done: VerifyCallback,
  ): void {
    const { id, username, displayName, emails, photos } = profile;

    const email =
      emails && emails.length > 0 ? emails[0].value : `${username}@github.com`;

    const fullName = displayName ?? username ?? 'Unknown User';
    const [firstName, ...lastNameParts] = fullName.split(' ');
    const lastName = lastNameParts.join(' ') || username;

    const user = {
      provider: 'github',
      providerId: id,
      email: email,
      firstName: firstName,
      lastName: lastName,
      avatar: photos && photos.length > 0 ? photos[0].value : null,
    };

    done(null, user);
  }
}
