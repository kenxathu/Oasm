import { axiosInstance } from '@/services/apis/axios-client';

export type CreateNetworkInterfaceDto = {
  interfaceName: string;
  ipAddress: string;
  cidr: string;
  gatewayIp: string;
  gatewayMac: string;
  workerId: string;
};

export type UpdateNetworkInterfaceDto = Partial<CreateNetworkInterfaceDto>;

export type DefaultMessageResponseDto = {
  message: string;
};

export const createNetworkInterface = (
  networkId: string,
  data: CreateNetworkInterfaceDto,
) => {
  return axiosInstance.post<DefaultMessageResponseDto>(
    `/api/internal-networks/${networkId}/network-interfaces`,
    data,
  );
};

export const updateNetworkInterface = (
  networkId: string,
  id: string,
  data: UpdateNetworkInterfaceDto,
) => {
  return axiosInstance.patch<DefaultMessageResponseDto>(
    `/api/internal-networks/${networkId}/network-interfaces/${id}`,
    data,
  );
};

export const deleteNetworkInterface = (
  networkId: string,
  id: string,
) => {
  return axiosInstance.delete<DefaultMessageResponseDto>(
    `/api/internal-networks/${networkId}/network-interfaces/${id}`,
  );
};
