import { IsString, IsInt, Min, Max, IsOptional } from 'class-validator';

export class CreateRatingDto {
  @IsString()
  orderId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  score: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
