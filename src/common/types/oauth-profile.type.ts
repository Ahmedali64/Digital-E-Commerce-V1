export interface OAuthProfile {
  provider: 'google' | 'github';
  providerId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
}
