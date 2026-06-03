import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

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

  @ApiProperty({ description: 'The gateway IP address for the network interface' })
  @IsString()
  @IsNotEmpty()
  gatewayIp: string;

  @ApiProperty({ description: 'The gateway MAC address for the network interface' })
  @IsString()
  @IsNotEmpty()
  gatewayMac: string;

  @ApiProperty({ description: 'The worker ID associated with this network interface' })
  @IsUUID('4')
  workerId: string;
}
