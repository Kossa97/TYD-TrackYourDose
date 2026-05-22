import { Capacitor } from '@capacitor/core';
import { CapacitorHealthkit } from '@perfood/capacitor-healthkit';
import type { OtherData, SleepData } from '@perfood/capacitor-healthkit';
import { HealthConnect } from 'capacitor-health-connect';
import type { Record as HealthConnectRecord, RecordType } from 'capacitor-health-connect';

const DAY_MS = 24 * 60 * 60 * 1000;

const IOS_READ_PERMISSIONS = ['weight', 'steps', 'activity', 'heartRate'];
const ANDROID_READ_PERMISSIONS: RecordType[] = ['Weight', 'Steps', 'HeartRateSeries'];

export const isNative = Capacitor.isNativePlatform();
export const isIOS = Capacitor.getPlatform() === 'ios';
export const isAndroid = Capacitor.getPlatform() === 'android';

export type HealthPlatform = 'ios' | 'android' | 'web' | string;

export interface HealthPermissionResult {
  platform: HealthPlatform;
  available: boolean;
  granted: boolean;
  reason?: string;
  grantedPermissions?: string[];
}

export interface HealthQueryOptions {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface HealthWeight {
  valueKg: number;
  date: Date;
  source?: string;
}

export interface HealthSteps {
  count: number;
  startDate: Date;
  endDate: Date;
}

export interface HealthSleep {
  startDate: Date;
  endDate: Date;
  durationHours: number;
  state?: string;
  source?: string;
}

export interface HealthHeartRate {
  bpm: number;
  date: Date;
  source?: string;
}

type HealthConnectReadRecordsResult = Awaited<ReturnType<typeof HealthConnect.readRecords>>;
type HealthConnectStoredRecord = HealthConnectReadRecordsResult['records'][number];
type HealthConnectWeightRecord = HealthConnectStoredRecord & Extract<HealthConnectRecord, { type: 'Weight' }>;
type HealthConnectStepsRecord = HealthConnectStoredRecord & Extract<HealthConnectRecord, { type: 'Steps' }>;
type HealthConnectHeartRateRecord = HealthConnectStoredRecord & Extract<HealthConnectRecord, { type: 'HeartRateSeries' }>;

function platform(): HealthPlatform {
  return Capacitor.getPlatform();
}

function queryRange(options: HealthQueryOptions | undefined, fallbackDays: number) {
  const endDate = options?.endDate ?? new Date();
  const startDate = options?.startDate ?? new Date(endDate.getTime() - fallbackDays * DAY_MS);

  return { startDate, endDate, limit: options?.limit ?? 0 };
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

function sortByDateDesc<T>(items: T[], getDate: (item: T) => Date) {
  return [...items].sort((a, b) => getDate(b).getTime() - getDate(a).getTime());
}

function getHealthKitSource(sample: OtherData | SleepData) {
  return sample.source || sample.sourceBundleId || undefined;
}

async function queryHealthKit<T extends OtherData | SleepData>(sampleName: string, options?: HealthQueryOptions) {
  const { startDate, endDate, limit } = queryRange(options, 1);

  const response = await CapacitorHealthkit.queryHKitSampleType<T>({
    sampleName,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    limit,
  });

  return response.resultData ?? [];
}

async function readHealthConnectRecords<T extends HealthConnectStoredRecord>(
  type: RecordType,
  options?: HealthQueryOptions,
  fallbackDays = 1,
) {
  const { startDate, endDate, limit } = queryRange(options, fallbackDays);
  const response = await HealthConnect.readRecords({
    type,
    timeRangeFilter: {
      type: 'between',
      startTime: startDate,
      endTime: endDate,
    },
    ascendingOrder: false,
    pageSize: limit > 0 ? limit : 1000,
  });

  return response.records as T[];
}

export async function requestPermissions(): Promise<HealthPermissionResult> {
  if (!isNative) {
    return {
      platform: platform(),
      available: false,
      granted: false,
      reason: 'Health data is only available on native iOS and Android builds.',
    };
  }

  if (isIOS) {
    try {
      await CapacitorHealthkit.isAvailable();
      await CapacitorHealthkit.requestAuthorization({
        all: [],
        read: IOS_READ_PERMISSIONS,
        write: [],
      });

      return {
        platform: 'ios',
        available: true,
        granted: true,
      };
    } catch (error) {
      return {
        platform: 'ios',
        available: false,
        granted: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  if (isAndroid) {
    const { availability } = await HealthConnect.checkAvailability();

    if (availability !== 'Available') {
      return {
        platform: 'android',
        available: false,
        granted: false,
        reason: `Health Connect is ${availability}.`,
      };
    }

    const permissions = await HealthConnect.requestHealthPermissions({
      read: ANDROID_READ_PERMISSIONS,
      write: [],
    });

    return {
      platform: 'android',
      available: true,
      granted: permissions.hasAllPermissions,
      grantedPermissions: permissions.grantedPermissions,
    };
  }

  return {
    platform: platform(),
    available: false,
    granted: false,
    reason: 'Unsupported native platform.',
  };
}

export async function getWeight(options?: HealthQueryOptions): Promise<HealthWeight | null> {
  if (!isNative) return null;

  if (isIOS) {
    const samples = await queryHealthKit<OtherData>('weight', {
      ...options,
      limit: options?.limit ?? 0,
      startDate: options?.startDate ?? new Date(Date.now() - 365 * DAY_MS),
    });
    const latest = sortByDateDesc(samples, sample => toDate(sample.endDate))[0];

    if (!latest) return null;

    return {
      valueKg: latest.value,
      date: toDate(latest.endDate),
      source: getHealthKitSource(latest),
    };
  }

  if (isAndroid) {
    const records = await readHealthConnectRecords<HealthConnectWeightRecord>('Weight', {
      ...options,
      startDate: options?.startDate ?? new Date(Date.now() - 365 * DAY_MS),
    }, 365);
    const latest = sortByDateDesc(records, record => toDate(record.time))[0];

    if (!latest) return null;

    return {
      valueKg: latest.weight.value,
      date: toDate(latest.time),
      source: latest.metadata.dataOrigin,
    };
  }

  return null;
}

export async function getSteps(options?: HealthQueryOptions): Promise<HealthSteps | null> {
  if (!isNative) return null;

  const startDate = options?.startDate ?? startOfToday();
  const endDate = options?.endDate ?? new Date();

  if (isIOS) {
    const samples = await queryHealthKit<OtherData>('stepCount', {
      ...options,
      startDate,
      endDate,
    });

    return {
      count: samples.reduce((sum, sample) => sum + sample.value, 0),
      startDate,
      endDate,
    };
  }

  if (isAndroid) {
    const records = await readHealthConnectRecords<HealthConnectStepsRecord>('Steps', {
      ...options,
      startDate,
      endDate,
    });

    return {
      count: records.reduce((sum, record) => sum + record.count, 0),
      startDate,
      endDate,
    };
  }

  return null;
}

export async function getSleep(options?: HealthQueryOptions): Promise<HealthSleep[]> {
  if (!isNative) return [];

  if (isIOS) {
    const samples = await queryHealthKit<SleepData>('sleepAnalysis', {
      ...options,
      startDate: options?.startDate ?? new Date(Date.now() - DAY_MS),
    });

    return sortByDateDesc(samples, sample => toDate(sample.endDate)).map(sample => ({
      startDate: toDate(sample.startDate),
      endDate: toDate(sample.endDate),
      durationHours: sample.duration,
      state: sample.sleepState,
      source: getHealthKitSource(sample),
    }));
  }

  // The current capacitor-health-connect release does not expose SleepSession records.
  return [];
}

export async function getHeartRate(options?: HealthQueryOptions): Promise<HealthHeartRate[]> {
  if (!isNative) return [];

  if (isIOS) {
    const samples = await queryHealthKit<OtherData>('heartRate', options);

    return sortByDateDesc(samples, sample => toDate(sample.endDate)).map(sample => ({
      bpm: sample.value,
      date: toDate(sample.endDate),
      source: getHealthKitSource(sample),
    }));
  }

  if (isAndroid) {
    const records = await readHealthConnectRecords<HealthConnectHeartRateRecord>('HeartRateSeries', options);
    const samples = records.flatMap(record =>
      record.samples.map(sample => ({
        bpm: sample.beatsPerMinute,
        date: toDate(sample.time),
        source: record.metadata.dataOrigin,
      })),
    );

    return sortByDateDesc(samples, sample => sample.date);
  }

  return [];
}
