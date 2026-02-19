import { IsString, IsOptional, IsEmail, MaxLength } from 'class-validator';

export class ClientProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  companyType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  inn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(9)
  kpp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  legalAddress?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  preferredPaymentType?: string;
}
