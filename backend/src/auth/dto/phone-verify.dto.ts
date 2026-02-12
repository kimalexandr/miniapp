import { IsString, Matches, Length } from 'class-validator';

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

export class RequestPhoneCodeDto {
  @IsString()
  @Matches(E164_REGEX, { message: 'Номер должен быть в формате E.164, например +79001234567' })
  phone: string;
}

export class ConfirmPhoneDto {
  @IsString()
  @Matches(E164_REGEX, { message: 'Номер должен быть в формате E.164' })
  phone: string;

  @IsString()
  @Length(4, 8, { message: 'Код должен быть от 4 до 8 символов' })
  code: string;
}
