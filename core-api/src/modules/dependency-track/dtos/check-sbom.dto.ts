import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl } from 'class-validator';

export class CheckSbomDto {
  @ApiProperty({
    description: 'The URL of the SBOM file or endpoint to scan.',
    example: 'https://example.com/sbom.json',
  })
  @IsString()
  @IsUrl()
  sbomUrl: string;
}
