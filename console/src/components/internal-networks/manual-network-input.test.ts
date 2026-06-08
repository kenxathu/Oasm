import { describe, expect, it } from 'vitest';

import { createManualNetworkInterfacePayload } from './manual-network-input';

describe('createManualNetworkInterfacePayload', () => {
  it('normalizes a typed IPv4 CIDR into a manual network interface payload', () => {
    expect(
      createManualNetworkInterfacePayload({
        interfaceName: 'Office LAN',
        networkCidr: '10.20.30.45/24',
      }),
    ).toEqual({
      interfaceName: 'Office LAN',
      ipAddress: '10.20.30.0',
      cidr: '10.20.30.0/24',
    });
  });

  it('uses a stable manual name when the label is empty', () => {
    expect(
      createManualNetworkInterfacePayload({
        interfaceName: '',
        networkCidr: '192.168.10.0/24',
      }).interfaceName,
    ).toBe('Manual 192.168.10.0/24');
  });

  it('rejects invalid network CIDR input', () => {
    expect(() =>
      createManualNetworkInterfacePayload({
        interfaceName: 'Bad network',
        networkCidr: '999.168.10.0/24',
      }),
    ).toThrow('Enter a valid IPv4 CIDR');
  });

  it('rejects malformed IPv4 CIDR input', () => {
    expect(() =>
      createManualNetworkInterfacePayload({
        interfaceName: 'Bad network',
        networkCidr: '10..10.0/24',
      }),
    ).toThrow('Enter a valid IPv4 CIDR');

    expect(() =>
      createManualNetworkInterfacePayload({
        interfaceName: 'Bad network',
        networkCidr: '10.10.10.0/',
      }),
    ).toThrow('Enter a valid IPv4 CIDR');
  });
});
