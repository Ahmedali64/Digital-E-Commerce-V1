import { registerDecorator, ValidationOptions } from 'class-validator';

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any /*args: ValidationArguments */) {
          if (typeof value !== 'string') return false;

          // Min 8 chars, at least 1 uppercase, 1 lowercase, 1 number, 1 Special character
          const strongPasswordRegex =
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
          return strongPasswordRegex.test(value);
        },
        defaultMessage() {
          return 'Password must be at least 8 characters long and contain uppercase, lowercase, special character, and number';
        },
      },
    });
  };
}
