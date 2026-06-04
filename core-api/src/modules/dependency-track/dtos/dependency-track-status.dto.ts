import { ApiProperty } from '@nestjs/swagger';

export class DependencyTrackStatusDto {
  @ApiProperty({ example: 'ok' })
  status: string;

  @ApiProperty({ example: 'Dependency Track connection established successfully' })
  message: string;
}
