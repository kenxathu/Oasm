import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { RedisService } from '@/services/redis/redis.service';
import { Logger } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import axios from 'axios';
import { StorageService } from '../storage/storage.service';
import { SystemConfig } from './entities/system-config.entity';
import { SystemConfigsService } from './system-configs.service';

type LooseMock = ReturnType<typeof jest.fn> & {
  mockResolvedValue(value: unknown): LooseMock;
  mockRejectedValue(value: unknown): LooseMock;
  mockReturnValue(value: unknown): LooseMock;
};

const mockFn = (): LooseMock => jest.fn() as LooseMock;

describe('SystemConfigsService', () => {
  let service: SystemConfigsService;
  let mockSystemConfigRepository: {
    findOne: LooseMock;
    create: LooseMock;
    save: LooseMock;
  };
  let mockRedisService: { get: LooseMock; set: LooseMock };
  let mockStorageService: { deleteFile: LooseMock };

  beforeEach(async () => {
    mockSystemConfigRepository = {
      findOne: mockFn(),
      create: mockFn(),
      save: mockFn(),
    };

    mockStorageService = {
      deleteFile: mockFn(),
    };

    mockRedisService = {
      get: mockFn(),
      set: mockFn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemConfigsService,
        {
          provide: getRepositoryToken(SystemConfig),
          useValue: mockSystemConfigRepository,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<SystemConfigsService>(SystemConfigsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('logs latest-version fetch failures without raw request metadata', async () => {
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const axiosGet = jest.spyOn(axios, 'get').mockRejectedValue(
      Object.assign(new Error('getaddrinfo EAI_AGAIN api.github.com'), {
        config: {
          headers: {
            'X-Api-Key': 'secret-token',
          },
        },
        request: {
          _header: 'X-Api-Key: secret-token',
        },
      }),
    );

    mockRedisService.get.mockResolvedValue(null);

    try {
      await service.onModuleInit();

      expect(loggerError).toHaveBeenCalledWith(
        'Error fetching latest version: getaddrinfo EAI_AGAIN api.github.com',
      );
      expect(loggerError.mock.calls).toHaveLength(1);
      expect(loggerError.mock.calls[0]).toHaveLength(1);
      expect(
        loggerError.mock.calls
          .map((call) => call.map((argument) => String(argument)).join(' '))
          .join('\n'),
      ).not.toContain('secret-token');
    } finally {
      axiosGet.mockRestore();
      loggerError.mockRestore();
    }
  });

  describe('removeLogo', () => {
    it('should remove logo and set logoPath to null', async () => {
      const mockConfig = {
        id: 1,
        name: 'Test System',
        logoPath: '/uploads/logo.png',
      };

      mockSystemConfigRepository.findOne.mockResolvedValue(mockConfig);
      mockSystemConfigRepository.save.mockResolvedValue({
        ...mockConfig,
        logoPath: null,
      });

      const result = await service.removeLogo();

      expect(mockSystemConfigRepository.findOne).toHaveBeenCalled();
      expect(mockSystemConfigRepository.save).toHaveBeenCalledWith({
        ...mockConfig,
        logoPath: null,
      });
      expect(result).toEqual({
        message: 'System logo removed successfully',
      });
    });

    it('should create default config if none exists and return no logo message', async () => {
      const mockConfig = {
        id: 1,
        name: 'BAOVIET ATTACK SURFACE MANAGEMENT',
        logoPath: null,
      };

      mockSystemConfigRepository.findOne.mockResolvedValue(null);
      mockSystemConfigRepository.create.mockReturnValue(mockConfig);
      mockSystemConfigRepository.save.mockResolvedValue(mockConfig);

      const result = await service.removeLogo();

      expect(mockSystemConfigRepository.findOne).toHaveBeenCalled();
      expect(mockSystemConfigRepository.create).toHaveBeenCalledWith({
        name: 'BAOVIET ATTACK SURFACE MANAGEMENT',
        logoPath: undefined,
      });
      expect(result).toEqual({
        message: 'No system logo to remove',
      });
    });
  });
});
