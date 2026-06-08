import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateNetworkInterfaceDto {
  @ApiProperty({ description: 'The name of the network interface' })
  @IsString()
  @IsNotEmpty()
  interfaceName: string;

  @ApiProperty({ description: 'The IP address of the network interface' })
  @IsString()
  @IsNotEmpty()
  ipAddress: string;

  @ApiProperty({ description: 'The CIDR of the network interface' })
  @IsString()
  @IsNotEmpty()
  cidr: string;

  @ApiPropertyOptional({
    description: 'The gateway IP address for the network interface',
  })
  @IsOptional()
  @IsString()
  gatewayIp?: string;

  @ApiPropertyOptional({
    description: 'The gateway MAC address for the network interface',
  })
  @IsOptional()
  @IsString()
  gatewayMac?: string;

  @ApiPropertyOptional({
    description: 'The worker ID associated with this network interface',
  })
  @IsOptional()
  @IsUUID('4')
  workerId?: string;
}
