import type { PackageType } from '../../types/PackageType';
import { newId } from '../../domain/id';
import { DomainError } from '../../domain/errors';

interface BuildPackageTypeParams {
  name: string;
  treatmentTypeId: string;
  price: string | number;
  isSeries: boolean;
  treatmentCount?: number;
  isTimerBased?: boolean;
  minutesPerTreatment?: number;
}

interface BuildPackageTypeDeps {
  newId?: () => string;
}

export function buildPackageType(
  params: BuildPackageTypeParams,
  deps: BuildPackageTypeDeps = {}
): PackageType {
  if (!params.name.trim()) {
    throw new DomainError('PACKAGE_NAME_REQUIRED', 'שם החבילה לא יכול להיות ריק');
  }
  if (!params.treatmentTypeId.trim()) {
    throw new DomainError('PACKAGE_TREATMENT_TYPE_REQUIRED', 'יש לבחור סוג טיפול');
  }
  const priceNum = typeof params.price === 'number' ? params.price : parseFloat(params.price);
  if (isNaN(priceNum) || priceNum < 0) {
    throw new DomainError('PACKAGE_INVALID_PRICE', 'מחיר לא תקין');
  }
  if (!Number.isFinite(priceNum)) {
    throw new DomainError('PACKAGE_INVALID_PRICE', 'מחיר לא תקין');
  }
  if (priceNum > 999_999) {
    throw new DomainError('PACKAGE_PRICE_TOO_HIGH', 'מחיר גבוה מדי');
  }
  // Round to 2 decimal places and format as string
  const canonicalPrice = (Math.round(priceNum * 100) / 100).toFixed(2);

  if (params.isTimerBased && !params.isSeries) {
    throw new DomainError('PACKAGE_TIMER_REQUIRES_SERIES', 'חבילה מבוססת טיימר חייבת להיות סדרה');
  }
  if (params.isSeries && (!params.treatmentCount || params.treatmentCount <= 0)) {
    throw new DomainError('PACKAGE_TREATMENT_COUNT_REQUIRED', 'מספר הטיפולים חייב להיות גדול מ-0 עבור סדרה');
  }
  if (params.isTimerBased && (!params.minutesPerTreatment || params.minutesPerTreatment <= 0)) {
    throw new DomainError('PACKAGE_MINUTES_REQUIRED', 'דקות לטיפול חייבות להיות גדולות מ-0 עבור חבילה מבוססת טיימר');
  }

  const genId = deps.newId ?? newId;

  return {
    id: genId(),
    name: params.name.trim(),
    treatmentTypeId: params.treatmentTypeId,
    price: canonicalPrice,
    isSeries: params.isSeries,
    ...(params.isSeries ? { treatmentCount: params.treatmentCount } : {}),
    ...(params.isTimerBased ? { isTimerBased: true, minutesPerTreatment: params.minutesPerTreatment } : { isTimerBased: false }),
  };
}

export function updatePackageType(
  id: string,
  updated: PackageType,
  current: PackageType[]
): PackageType[] {
  return current.map(pt => pt.id === id ? { ...updated, id } : pt);
}

export function deletePackageType(
  id: string,
  current: PackageType[]
): PackageType[] {
  return current.filter(pt => pt.id !== id);
}
