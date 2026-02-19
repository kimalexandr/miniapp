import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsNumber,
  IsDateString,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  fromWarehouseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  toAddress?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  toLatitude?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  toLongitude?: number;

  @IsOptional()
  @IsDateString()
  preferredDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  preferredTimeFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  preferredTimeTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  cargoType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cargoVolume?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  cargoWeight?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  cargoPlaces?: number;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  pickupRequired?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  specialConditions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;

  @IsOptional()
  @IsDateString()
  responseDeadline?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  paymentType?: string;
}
