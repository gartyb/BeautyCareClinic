import type { CustomerOrder, OrderItem } from '../../types/Order';
import type { TreatmentSeries } from '../../types/TreatmentSeries';
import type { PackageType } from '../../types/PackageType';
import type { User } from '../../types/User';
import { newId } from '../../domain/id';
import { toCents, fromCents } from '../../domain/money';
import { DEFAULT_MAX_PAYMENT_COUNT } from '../../domain/constants';

interface BuildOrderDeps {
  newId?: () => string;
  now?: () => string;
}

interface BuildOrderResult {
  order: CustomerOrder;
  series: TreatmentSeries[];
}

export function buildNewOrder(
  customerId: string,
  selectedPackageTypeIds: string[],
  packageTypes: PackageType[],
  currentUser: User,
  maxPaymentCountOverride?: number,
  deps: BuildOrderDeps = {}
): BuildOrderResult {
  const genId = deps.newId ?? newId;
  const now = deps.now ?? (() => new Date().toISOString());

  const selectedPackages = selectedPackageTypeIds
    .map(id => packageTypes.find(pt => pt.id === id))
    .filter((pt): pt is PackageType => pt !== undefined);

  const totalCents = selectedPackages.reduce((sum, pt) => sum + toCents(pt.price), 0);
  const orderId = genId();
  const createdDate = now();

  const orderItems: OrderItem[] = [];
  const seriesList: TreatmentSeries[] = [];

  for (const pt of selectedPackages) {
    const itemId = genId();
    let treatmentSeriesId: string | undefined;

    if (pt.isSeries) {
      const seriesId = genId();
      treatmentSeriesId = seriesId;
      const series: TreatmentSeries = {
        id: seriesId,
        orderItemId: itemId,
        packageTypeId: pt.id,
        customerId,
        seriesKind: pt.isTimerBased ? 'timer' : 'quantity',
        createdDate,
        ...(pt.isTimerBased
          ? {
              totalMinutes: (pt.treatmentCount ?? 1) * (pt.minutesPerTreatment ?? 60),
              usedMinutes: 0,
              minutesPerTreatment: pt.minutesPerTreatment ?? 60,
            }
          : {
              totalTreatments: pt.treatmentCount ?? 1,
              completedTreatments: 0,
            }),
      };
      seriesList.push(series);
    }

    orderItems.push({ id: itemId, customerOrderId: orderId, packageTypeId: pt.id, treatmentSeriesId });
  }

  const order: CustomerOrder = {
    id: orderId,
    customerId,
    totalPrice: fromCents(totalCents),
    amountPaid: '0.00',
    remainingBalance: fromCents(totalCents),
    maxPaymentCount: maxPaymentCountOverride ?? DEFAULT_MAX_PAYMENT_COUNT,
    paymentCount: 0,
    orderItems,
    createdDate,
    createdByUserId: currentUser.id,
  };

  return { order, series: seriesList };
}
