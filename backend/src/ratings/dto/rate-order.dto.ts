import { IsInt, Min, Max, IsOptional, IsString } from 'class-validator';

export class RateOrderDto {
  @IsInt()
  @Min(1)
  @Max(5)
  score: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
