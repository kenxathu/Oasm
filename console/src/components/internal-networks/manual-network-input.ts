import type { CreateNetworkInterfaceDto } from '@/services/apis/internal-networks';

type ManualNetworkInput = {
  interfaceName: string;
  networkCidr: string;
};

type ParsedIpv4Cidr = {
  networkAddress: string;
  normalizedCidr: string;
};

const IPV4_OCTET_COUNT = 4;
const IPV4_BITS = 32;

function parseIpv4Cidr(value: string): ParsedIpv4Cidr {
  const [rawIp, rawPrefix, ...rest] = value.trim().split('/');
  const prefix = Number(rawPrefix);

  if (
    rest.length > 0 ||
    !rawIp ||
    rawPrefix === undefined ||
    !/^\d+$/.test(rawPrefix) ||
    !Number.isInteger(prefix) ||
    prefix < 0 ||
    prefix > IPV4_BITS
  ) {
    throw new Error('Enter a valid IPv4 CIDR');
  }

  const rawOctets = rawIp.split('.');
  const octets = rawOctets.map((octet) => Number(octet));

  if (
    rawOctets.length !== IPV4_OCTET_COUNT ||
    rawOctets.some((octet) => !/^\d+$/.test(octet)) ||
    octets.some(
      (octet) => !Number.isInteger(octet) || octet < 0 || octet > 255,
    )
  ) {
    throw new Error('Enter a valid IPv4 CIDR');
  }

  const ipNumber = octets.reduce((result, octet) => {
    return result * 256 + octet;
  }, 0);
  const mask =
    prefix === 0 ? 0 : (0xffffffff << (IPV4_BITS - prefix)) >>> 0;
  const networkNumber = (ipNumber & mask) >>> 0;
  const networkOctets = [
    (networkNumber >>> 24) & 255,
    (networkNumber >>> 16) & 255,
    (networkNumber >>> 8) & 255,
    networkNumber & 255,
  ];
  const networkAddress = networkOctets.join('.');

  return {
    networkAddress,
    normalizedCidr: `${networkAddress}/${prefix}`,
  };
}

export function createManualNetworkInterfacePayload({
  interfaceName,
  networkCidr,
}: ManualNetworkInput): CreateNetworkInterfaceDto {
  const { networkAddress, normalizedCidr } = parseIpv4Cidr(networkCidr);
  const trimmedInterfaceName = interfaceName.trim();

  return {
    interfaceName: trimmedInterfaceName || `Manual ${normalizedCidr}`,
    ipAddress: networkAddress,
    cidr: normalizedCidr,
  };
}
