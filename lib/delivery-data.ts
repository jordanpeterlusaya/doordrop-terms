import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';

import { compactFirestoreData } from '@/lib/firestore-payload';
import { db } from '@/lib/firebase';
import { createOrderStatusNotification } from '@/lib/user-notifications';

export type DeliveryFlow = 'parcel' | 'cargo';
export type DeliveryTimingMode = 'now' | 'later';
export type DeliveryCancellationActor = 'customer' | 'driver' | 'dispatch';
export type DeliveryOrderStatus =
  | 'pending_assignment'
  | 'driver_assigned'
  | 'driver_at_pickup'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

export type DriverVehicleType = 'motorbike' | 'pickup' | 'van' | 'truck';

export type DeliveryOrder = {
  id: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  flow: DeliveryFlow;
  serviceLabel: string;
  status: DeliveryOrderStatus;
  pickupLabel: string;
  dropoffLabel: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  etaLabel: string;
  fareLabel: string;
  totalLabel: string;
  routeLabel?: string;
  routeGeometry?: string;
  timingMode: DeliveryTimingMode;
  scheduleDate?: string;
  scheduleTime?: string;
  scheduleLabel: string;
  recipientName: string;
  recipientPhone: string;
  parcelScope?: string;
  parcelTypeKey?: string;
  parcelTypeLabel?: string;
  cargoVehicleKey?: string;
  cargoVehicleLabel?: string;
  cargoCapacityLabel?: string;
  distanceLabel?: string;
  durationLabel?: string;
  distanceMeters?: number;
  durationSeconds?: number;
  cancellationReason?: string;
  cancelledBy?: DeliveryCancellationActor;
  cancelledAt?: unknown;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverVehicleType?: DriverVehicleType;
  driverVehicleLabel?: string;
  driverPlateNumber?: string;
  driverLatitude?: number;
  driverLongitude?: number;
  driverHeading?: number;
  driverSpeedKph?: number;
  driverAccuracyMeters?: number;
  driverLocationUpdatedAt?: unknown;
  acceptedByDriverAt?: unknown;
  assignedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type DriverRecord = {
  id: string;
  fullName: string;
  email?: string;
  authUid?: string;
  phoneNumber: string;
  vehicleType?: DriverVehicleType;
  vehicleLabel: string;
  vehicleColor?: string;
  plateNumber: string;
  isAvailable: boolean;
  currentOrderId?: string;
  currentLatitude?: number;
  currentLongitude?: number;
  currentHeading?: number;
  currentSpeedKph?: number;
  currentAccuracyMeters?: number;
  lastLocationUpdatedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type CreateDeliveryOrderInput = {
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  flow: DeliveryFlow;
  serviceLabel: string;
  pickupLabel: string;
  dropoffLabel: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  etaLabel: string;
  fareLabel: string;
  totalLabel: string;
  routeLabel?: string;
  routeGeometry?: string;
  timingMode: DeliveryTimingMode;
  scheduleDate?: string;
  scheduleTime?: string;
  scheduleLabel: string;
  recipientName: string;
  recipientPhone: string;
  parcelScope?: string;
  parcelTypeKey?: string;
  parcelTypeLabel?: string;
  cargoVehicleKey?: string;
  cargoVehicleLabel?: string;
  cargoCapacityLabel?: string;
  distanceLabel?: string;
  durationLabel?: string;
  distanceMeters?: number;
  durationSeconds?: number;
};

export type CreateDriverInput = Pick<DriverRecord, 'fullName' | 'phoneNumber' | 'vehicleLabel' | 'plateNumber'>;
export type RegisterDriverInput = Pick<
  DriverRecord,
  'fullName' | 'phoneNumber' | 'vehicleLabel' | 'plateNumber' | 'vehicleType' | 'vehicleColor'
> & {
  uid: string;
  email?: string;
};
export type UpdateDriverLocationInput = {
  latitude: number;
  longitude: number;
  heading?: number;
  speedKph?: number;
  accuracyMeters?: number;
};

export const deliveryOrderStatusOptions: DeliveryOrderStatus[] = [
  'pending_assignment',
  'driver_assigned',
  'driver_at_pickup',
  'in_transit',
  'delivered',
  'cancelled',
];

const ordersCollection = collection(db, 'orders');
const driversCollection = collection(db, 'drivers');

const deliveryOrderStatusLabels: Record<DeliveryOrderStatus, string> = {
  pending_assignment: 'Waiting for driver',
  driver_assigned: 'Driver assigned',
  driver_at_pickup: 'Driver at pickup',
  in_transit: 'In transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function orderRef(orderId: string) {
  return doc(db, 'orders', orderId);
}

function driverRef(driverId: string) {
  return doc(db, 'drivers', driverId);
}

function toMillis(value: unknown) {
  if (!value) {
    return 0;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'object' && value !== null && 'toMillis' in value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

function sortOrders(items: DeliveryOrder[]) {
  return [...items].sort((left, right) => {
    return toMillis(right.updatedAt ?? right.createdAt) - toMillis(left.updatedAt ?? left.createdAt);
  });
}

function sortDrivers(items: DriverRecord[]) {
  return [...items].sort((left, right) => {
    if (left.isAvailable !== right.isAvailable) {
      return left.isAvailable ? -1 : 1;
    }

    return left.fullName.localeCompare(right.fullName);
  });
}

function getSnapshotItems<T extends { id: string }>(
  items: { id: string; data: () => Record<string, unknown> }[]
) {
  return items.map((item) => ({ id: item.id, ...item.data() })) as T[];
}

function getGeneratedOrderNumber(documentId: string) {
  return `DD-${documentId.slice(0, 6).toUpperCase()}`;
}

function clearDriverAssignmentFields() {
  return {
    driverId: deleteField(),
    driverName: deleteField(),
    driverPhone: deleteField(),
    driverVehicleType: deleteField(),
    driverVehicleLabel: deleteField(),
    driverPlateNumber: deleteField(),
    driverLatitude: deleteField(),
    driverLongitude: deleteField(),
    driverHeading: deleteField(),
    driverSpeedKph: deleteField(),
    driverAccuracyMeters: deleteField(),
    driverLocationUpdatedAt: deleteField(),
    acceptedByDriverAt: deleteField(),
    assignedAt: deleteField(),
  };
}

function buildDriverAssignmentPayload(driver: DriverRecord) {
  return compactFirestoreData({
    driverId: driver.id,
    driverName: driver.fullName,
    driverPhone: driver.phoneNumber,
    driverVehicleType: driver.vehicleType,
    driverVehicleLabel: driver.vehicleLabel,
    driverPlateNumber: driver.plateNumber,
    driverLatitude: driver.currentLatitude,
    driverLongitude: driver.currentLongitude,
    driverHeading: driver.currentHeading,
    driverSpeedKph: driver.currentSpeedKph,
    driverAccuracyMeters: driver.currentAccuracyMeters,
    driverLocationUpdatedAt: driver.lastLocationUpdatedAt ?? serverTimestamp(),
    acceptedByDriverAt: serverTimestamp(),
  });
}

export function getDeliveryOrderStatusLabel(status: DeliveryOrderStatus) {
  return deliveryOrderStatusLabels[status];
}

export function formatDeliveryDateTime(value?: unknown) {
  const millis = toMillis(value);

  if (!millis) {
    return 'Just now';
  }

  return new Date(millis).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export async function createDeliveryOrder(input: CreateDeliveryOrderInput) {
  const nextOrderRef = doc(ordersCollection);
  const orderNumber = getGeneratedOrderNumber(nextOrderRef.id);
  const order: Omit<DeliveryOrder, 'createdAt' | 'updatedAt' | 'assignedAt'> = {
    id: nextOrderRef.id,
    orderNumber,
    userId: input.userId,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    flow: input.flow,
    serviceLabel: input.serviceLabel,
    status: 'pending_assignment',
    pickupLabel: input.pickupLabel,
    dropoffLabel: input.dropoffLabel,
    pickupLatitude: input.pickupLatitude,
    pickupLongitude: input.pickupLongitude,
    dropoffLatitude: input.dropoffLatitude,
    dropoffLongitude: input.dropoffLongitude,
    etaLabel: input.etaLabel,
    fareLabel: input.fareLabel,
    totalLabel: input.totalLabel,
    routeLabel: input.routeLabel,
    routeGeometry: input.routeGeometry,
    timingMode: input.timingMode,
    scheduleDate: input.scheduleDate,
    scheduleTime: input.scheduleTime,
    scheduleLabel: input.scheduleLabel,
    recipientName: input.recipientName,
    recipientPhone: input.recipientPhone,
    parcelScope: input.parcelScope,
    parcelTypeKey: input.parcelTypeKey,
    parcelTypeLabel: input.parcelTypeLabel,
    cargoVehicleKey: input.cargoVehicleKey,
    cargoVehicleLabel: input.cargoVehicleLabel,
    cargoCapacityLabel: input.cargoCapacityLabel,
    distanceLabel: input.distanceLabel,
    durationLabel: input.durationLabel,
    distanceMeters: input.distanceMeters,
    durationSeconds: input.durationSeconds,
  };

  await setDoc(
    nextOrderRef,
    compactFirestoreData({
      ...order,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  await createOrderStatusNotification({
    userId: order.userId,
    orderId: order.id,
    orderNumber,
    serviceLabel: order.serviceLabel,
    status: 'pending_assignment',
  });

  return order;
}

export function subscribeToOrders(
  callback: (orders: DeliveryOrder[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    ordersCollection,
    (snapshot) => {
      callback(sortOrders(getSnapshotItems<DeliveryOrder>(snapshot.docs)));
    },
    (error) => onError?.(error)
  );
}

export function subscribeToUserOrders(
  userId: string,
  callback: (orders: DeliveryOrder[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const userOrdersQuery = query(ordersCollection, where('userId', '==', userId));

  return onSnapshot(
    userOrdersQuery,
    (snapshot) => {
      callback(sortOrders(getSnapshotItems<DeliveryOrder>(snapshot.docs)));
    },
    (error) => onError?.(error)
  );
}

export function subscribeToOrder(
  orderId: string,
  callback: (order: DeliveryOrder | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    orderRef(orderId),
    (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }

      callback({ id: snapshot.id, ...(snapshot.data() as Omit<DeliveryOrder, 'id'>) });
    },
    (error) => onError?.(error)
  );
}

export function subscribeToDrivers(
  callback: (drivers: DriverRecord[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    driversCollection,
    (snapshot) => {
      callback(sortDrivers(getSnapshotItems<DriverRecord>(snapshot.docs)));
    },
    (error) => onError?.(error)
  );
}

export function subscribeToDriver(
  driverId: string,
  callback: (driver: DriverRecord | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    driverRef(driverId),
    (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }

      callback({ id: snapshot.id, ...(snapshot.data() as Omit<DriverRecord, 'id'>) });
    },
    (error) => onError?.(error)
  );
}

export function subscribeToOpenOrders(
  callback: (orders: DeliveryOrder[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const openOrdersQuery = query(ordersCollection, where('status', '==', 'pending_assignment'));

  return onSnapshot(
    openOrdersQuery,
    (snapshot) => {
      callback(sortOrders(getSnapshotItems<DeliveryOrder>(snapshot.docs)));
    },
    (error) => onError?.(error)
  );
}

export function subscribeToDriverOrders(
  driverId: string,
  callback: (orders: DeliveryOrder[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const driverOrdersQuery = query(ordersCollection, where('driverId', '==', driverId));

  return onSnapshot(
    driverOrdersQuery,
    (snapshot) => {
      callback(sortOrders(getSnapshotItems<DeliveryOrder>(snapshot.docs)));
    },
    (error) => onError?.(error)
  );
}

export async function createDriver(input: CreateDriverInput) {
  const nextDriverRef = doc(driversCollection);
  const driver: Omit<DriverRecord, 'createdAt' | 'updatedAt'> = {
    id: nextDriverRef.id,
    fullName: input.fullName.trim(),
    phoneNumber: input.phoneNumber.trim(),
    vehicleLabel: input.vehicleLabel.trim(),
    plateNumber: input.plateNumber.trim().toUpperCase(),
    isAvailable: true,
    currentOrderId: '',
  };

  await setDoc(
    nextDriverRef,
    compactFirestoreData({
      ...driver,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  return driver;
}

export async function registerDriver(input: RegisterDriverInput) {
  const nextDriverRef = driverRef(input.uid);
  const driver: Omit<DriverRecord, 'createdAt' | 'updatedAt'> = {
    id: input.uid,
    authUid: input.uid,
    email: input.email?.trim().toLowerCase() || '',
    fullName: input.fullName.trim(),
    phoneNumber: input.phoneNumber.trim(),
    vehicleType: input.vehicleType,
    vehicleLabel: input.vehicleLabel.trim(),
    vehicleColor: input.vehicleColor?.trim() || '',
    plateNumber: input.plateNumber.trim().toUpperCase(),
    isAvailable: true,
    currentOrderId: '',
  };

  await setDoc(
    nextDriverRef,
    compactFirestoreData({
      ...driver,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
    { merge: true }
  );

  return driver;
}

export async function seedDemoDrivers() {
  const snapshot = await getDocs(driversCollection);
  if (!snapshot.empty) {
    return;
  }

  const starterDrivers: CreateDriverInput[] = [
    {
      fullName: 'Juma Kassim',
      phoneNumber: '+255754222333',
      vehicleLabel: 'Motorbike courier',
      plateNumber: 'MC 228 TZ',
    },
    {
      fullName: 'Neema David',
      phoneNumber: '+255742000777',
      vehicleLabel: 'Pickup cargo',
      plateNumber: 'T 542 DDX',
    },
    {
      fullName: 'Shabani Ally',
      phoneNumber: '+255713884552',
      vehicleLabel: 'Cargo van',
      plateNumber: 'T 884 CCF',
    },
  ];

  const batch = writeBatch(db);
  starterDrivers.forEach((driver) => {
    const nextDriverRef = doc(driversCollection);
    batch.set(nextDriverRef, {
      id: nextDriverRef.id,
      fullName: driver.fullName,
      phoneNumber: driver.phoneNumber,
      vehicleLabel: driver.vehicleLabel,
      plateNumber: driver.plateNumber,
      isAvailable: true,
      currentOrderId: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

export async function setDriverAvailability(driverId: string, isAvailable: boolean) {
  await updateDoc(
    driverRef(driverId),
    compactFirestoreData({
      isAvailable,
      currentOrderId: isAvailable ? '' : undefined,
      updatedAt: serverTimestamp(),
    })
  );
}

export async function assignDriverToOrder(orderId: string, driverId: string) {
  const [orderSnapshot, driverSnapshot] = await Promise.all([getDoc(orderRef(orderId)), getDoc(driverRef(driverId))]);

  if (!orderSnapshot.exists()) {
    throw new Error('Order was not found.');
  }

  if (!driverSnapshot.exists()) {
    throw new Error('Driver was not found.');
  }

  const order = { id: orderSnapshot.id, ...(orderSnapshot.data() as Omit<DeliveryOrder, 'id'>) };
  const driver = { id: driverSnapshot.id, ...(driverSnapshot.data() as Omit<DriverRecord, 'id'>) };

  if (!driver.isAvailable && driver.currentOrderId && driver.currentOrderId !== orderId) {
    throw new Error('This driver is already assigned to another order.');
  }

  const batch = writeBatch(db);

  if (order.driverId && order.driverId !== driver.id) {
    batch.update(driverRef(order.driverId), {
      isAvailable: true,
      currentOrderId: '',
      updatedAt: serverTimestamp(),
    });
  }

  batch.update(orderRef(orderId), {
    status: 'driver_assigned',
    ...buildDriverAssignmentPayload(driver),
    assignedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.update(driverRef(driver.id), {
    isAvailable: false,
    currentOrderId: orderId,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  await createOrderStatusNotification({
    userId: order.userId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    serviceLabel: order.serviceLabel,
    status: 'driver_assigned',
    driverName: driver.fullName,
  });
}

export async function acceptDeliveryOrder(orderId: string, driverId: string) {
  await assignDriverToOrder(orderId, driverId);
}

export async function unassignDriverFromOrder(orderId: string) {
  const orderSnapshot = await getDoc(orderRef(orderId));

  if (!orderSnapshot.exists()) {
    throw new Error('Order was not found.');
  }

  const order = { id: orderSnapshot.id, ...(orderSnapshot.data() as Omit<DeliveryOrder, 'id'>) };
  const batch = writeBatch(db);

  batch.update(orderRef(orderId), {
    status: 'pending_assignment',
    updatedAt: serverTimestamp(),
    ...clearDriverAssignmentFields(),
  });

  if (order.driverId) {
    batch.update(driverRef(order.driverId), {
      isAvailable: true,
      currentOrderId: '',
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();

  await createOrderStatusNotification({
    userId: order.userId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    serviceLabel: order.serviceLabel,
    status: 'pending_assignment',
  });
}

export async function updateDeliveryOrderStatus(orderId: string, status: DeliveryOrderStatus) {
  if (status === 'pending_assignment') {
    await unassignDriverFromOrder(orderId);
    return;
  }

  const orderSnapshot = await getDoc(orderRef(orderId));
  if (!orderSnapshot.exists()) {
    throw new Error('Order was not found.');
  }

  const order = { id: orderSnapshot.id, ...(orderSnapshot.data() as Omit<DeliveryOrder, 'id'>) };
  if (order.status === status) {
    return;
  }

  if (!order.driverId && ['driver_assigned', 'driver_at_pickup', 'in_transit', 'delivered'].includes(status)) {
    throw new Error('Assign a driver before moving this order forward.');
  }

  const batch = writeBatch(db);
  batch.update(orderRef(orderId), {
    status,
    updatedAt: serverTimestamp(),
  });

  if ((status === 'delivered' || status === 'cancelled') && order.driverId) {
    batch.update(driverRef(order.driverId), {
      isAvailable: true,
      currentOrderId: '',
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();

  await createOrderStatusNotification({
    userId: order.userId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    serviceLabel: order.serviceLabel,
    status,
    driverName: order.driverName,
  });
}

export async function cancelDeliveryOrderByUser(orderId: string, reason: string) {
  const trimmedReason = reason.trim();
  if (trimmedReason.length < 4) {
    throw new Error('Enter a short reason before cancelling the order.');
  }

  const orderSnapshot = await getDoc(orderRef(orderId));
  if (!orderSnapshot.exists()) {
    throw new Error('Order was not found.');
  }

  const order = { id: orderSnapshot.id, ...(orderSnapshot.data() as Omit<DeliveryOrder, 'id'>) };
  if (order.status === 'delivered') {
    throw new Error('Delivered orders cannot be cancelled.');
  }

  if (order.status === 'cancelled') {
    return;
  }

  const batch = writeBatch(db);
  batch.update(orderRef(orderId), {
    status: 'cancelled',
    cancellationReason: trimmedReason,
    cancelledBy: 'customer',
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (order.driverId) {
    batch.update(driverRef(order.driverId), {
      isAvailable: true,
      currentOrderId: '',
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();

  await createOrderStatusNotification({
    userId: order.userId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    serviceLabel: order.serviceLabel,
    status: 'cancelled',
    driverName: order.driverName,
    cancellationReason: trimmedReason,
    cancelledBy: 'customer',
  });
}

export async function updateDriverLocation(driverId: string, location: UpdateDriverLocationInput) {
  const driverSnapshot = await getDoc(driverRef(driverId));

  if (!driverSnapshot.exists()) {
    throw new Error('Driver was not found.');
  }

  const driver = { id: driverSnapshot.id, ...(driverSnapshot.data() as Omit<DriverRecord, 'id'>) };
  const driverPayload = compactFirestoreData({
    currentLatitude: location.latitude,
    currentLongitude: location.longitude,
    currentHeading: location.heading,
    currentSpeedKph: location.speedKph,
    currentAccuracyMeters: location.accuracyMeters,
    lastLocationUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(driverRef(driverId), driverPayload);

  if (!driver.currentOrderId) {
    return;
  }

  await updateDoc(
    orderRef(driver.currentOrderId),
    compactFirestoreData({
      driverLatitude: location.latitude,
      driverLongitude: location.longitude,
      driverHeading: location.heading,
      driverSpeedKph: location.speedKph,
      driverAccuracyMeters: location.accuracyMeters,
      driverLocationUpdatedAt: serverTimestamp(),
    })
  );
}
