import { IsString, IsOptional, IsEmail, IsNumber, MaxLength } from 'class-validator';

export class DriverProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  vehicleType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  vehiclePlate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  loadCapacity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  dimensions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  licenseInfo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  driverStatus?: string; // free, dogruz, busy
}

export class DriverLocationDto {
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;
}
