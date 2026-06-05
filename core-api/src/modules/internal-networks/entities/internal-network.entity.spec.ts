import { describe, expect, it } from '@jest/globals';
import { getMetadataArgsStorage } from 'typeorm';
import { InternalNetwork } from './internal-network.entity';

describe('InternalNetwork entity', () => {
  it('declares vulnerabilityScanJobId with an explicit postgres-supported type', () => {
    const column = getMetadataArgsStorage().columns.find(
      (metadata) =>
        metadata.target === InternalNetwork &&
        metadata.propertyName === 'vulnerabilityScanJobId',
    );

    expect(column?.options).toMatchObject({
      type: 'varchar',
      nullable: true,
    });
  });
});
