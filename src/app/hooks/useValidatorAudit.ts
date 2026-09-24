import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getCacheProfile } from "../lib/cacheProfiles";

export interface ValidatorNode {
  id: string;
  name: string;
  address: string;
  uptime: number;
  missedBlocks: number;
  slashingEvents: number;
  stakedXlm: number;
  status: "active" | "jailed" | "offline";
}

export interface ValidatorAuditData {
  validators: ValidatorNode[];
}

function getMockData(): ValidatorAuditData {
  return {
    validators: [
      {
        id: "val-01",
        name: "Kaduna Nexus Core",
        address: "GAA...42K",
        uptime: 99.94,
        missedBlocks: 2,
        slashingEvents: 0,
        stakedXlm: 50000,
        status: "active",
      },
      {
        id: "val-02",
        name: "Mombasa Relay Edge",
        address: "GBC...97X",
        uptime: 94.21,
        missedBlocks: 14,
        slashingEvents: 1,
        stakedXlm: 45000,
        status: "active",
      },
      {
        id: "val-03",
        name: "Accra Liquidity Node",
        address: "GDH...11W",
        uptime: 78.45,
        missedBlocks: 89,
        slashingEvents: 3,
        stakedXlm: 12000,
        status: "jailed",
      },
      {
        id: "val-04",
        name: "Lagos Ingestion Hub",
        address: "GDK...88P",
        uptime: 0.0,
        missedBlocks: 450,
        slashingEvents: 5,
        stakedXlm: 0,
        status: "offline",
      },
    ],
  };
}

const QUERY_KEY = ["validator-audit"] as const;

export function useValidatorAuditQuery(): UseQueryResult<
  ValidatorAuditData,
  Error
> {
  const profile = getCacheProfile("validatorAudit");

  return useQuery<ValidatorAuditData, Error>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/validator-audit", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch validator audit: ${res.status}`);
      }

      return res.json();
    },
    placeholderData: (prev) => prev,
    staleTime: profile.staleTime,
    gcTime: profile.gcTime,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useValidatorAudit(): {
  data: ValidatorAuditData;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
} {
  const query = useValidatorAuditQuery();

  if (query.data) {
    return {
      data: query.data,
      isLoading: false,
      isFetching: query.isFetching,
      error: query.error,
    };
  }

  return {
    data: getMockData(),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}
