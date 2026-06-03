import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateNetworkInterfaceDto {
  @ApiPropertyOptional({ description: 'The name of the network interface' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  interfaceName?: string;

  @ApiPropertyOptional({ description: 'The IP address of the network interface' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  ipAddress?: string;

  @ApiPropertyOptional({ description: 'The CIDR of the network interface' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cidr?: string;

  @ApiPropertyOptional({ description: 'The gateway IP address for the network interface' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  gatewayIp?: string;

  @ApiPropertyOptional({ description: 'The gateway MAC address for the network interface' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  gatewayMac?: string;

  @ApiPropertyOptional({ description: 'The worker ID associated with this network interface' })
  @IsOptional()
  @IsUUID('4')
  workerId?: string;
}
