import { IsString, IsOptional, IsBoolean, IsNumber, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWarehouseDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsString()
  @MaxLength(500)
  address: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitude?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  workSchedule?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactPerson?: string;

  @IsOptional()
  @Type(() => Boolean)
  pickupAvailable?: boolean;
}

export class UpdateWarehouseDto extends CreateWarehouseDto {}
