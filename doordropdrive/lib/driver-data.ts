import {
  collection,
  deleteField,
  doc,
  getDoc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';

import { compactFirestoreData } from './firestore-payload';
import { db } from './firebase';

export type DriverVehicleType = 'motorbike' | 'pickup' | 'van' | 'truck';
export type DeliveryOrderStatus =
  | 'pending_assignment'
  | 'driver_assigned'
  | 'driver_at_pickup'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

export type DeliveryOrder = {
  id: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
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
  scheduleLabel: string;
  recipientName: string;
  recipientPhone: string;
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
  cancellationReason?: string;
  cancelledBy?: 'customer' | 'driver' | 'dispatch';
  cancelledAt?: unknown;
  acceptedByDriverAt?: unknown;
  assignedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type DriverRecord = {
  id: string;
  authUid?: string;
  email?: string;
  fullName: string;
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
  appOpenCount?: number;
  lastActiveAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type RegisterDriverInput = {
  uid: string;
  email?: string;
  fullName: string;
  phoneNumber: string;
  vehicleType: DriverVehicleType;
  vehicleLabel: string;
  vehicleColor?: string;
  plateNumber: string;
};

export type UpdateDriverLocationInput = {
  latitude: number;
  longitude: number;
  heading?: number;
  speedKph?: number;
  accuracyMeters?: number;
};

const ordersCollection = collection(db, 'orders');
const userNotificationsCollection = collection(db, 'userNotifications');
const usersCollection = collection(db, 'users');

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

async function canSendOrderNotification(userId: string) {
  const userSnapshot = await getDoc(doc(usersCollection, userId));
  const preferences = userSnapshot.data()?.notificationPreferences as
    | {
        orderUpdates?: boolean;
      }
    | undefined;

  return preferences?.orderUpdates !== false;
}

function getOrderStatusNotificationCopy(input: {
  orderNumber: string;
  status: DeliveryOrderStatus;
  driverName?: string;
}) {
  if (input.status === 'driver_assigned') {
    return {
      title: 'Driver assigned',
      message: `${input.driverName || 'A driver'} has been assigned to ${input.orderNumber}.`,
    };
  }

  if (input.status === 'driver_at_pickup') {
    return {
      title: 'Driver reached pickup',
      message: `${input.orderNumber} has reached the pickup point and loading can begin.`,
    };
  }

  if (input.status === 'in_transit') {
    return {
      title: 'Order in transit',
      message: `${input.orderNumber} is now on the road to the drop-off.`,
    };
  }

  if (input.status === 'delivered') {
    return {
      title: 'Order delivered',
      message: `${input.orderNumber} was marked delivered successfully.`,
    };
  }

  return {
    title: 'Order cancelled',
    message: `${input.orderNumber} was cancelled. Contact support if this was unexpected.`,
  };
}

async function createOrderStatusNotification(input: {
  userId: string;
  orderId: string;
  orderNumber: string;
  status: DeliveryOrderStatus;
  driverName?: string;
}) {
  if (!(await canSendOrderNotification(input.userId))) {
    return;
  }

  const nextNotificationRef = doc(userNotificationsCollection);
  const copy = getOrderStatusNotificationCopy(input);

  await setDoc(
    nextNotificationRef,
    compactFirestoreData({
      userId: input.userId,
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      orderStatus: input.status,
      title: copy.title,
      message: copy.message,
      type: input.status === 'pending_assignment' ? 'order_created' : 'order_status',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
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

export async function recordDriverAppOpen(input: {
  uid: string;
  email?: string;
  fullName?: string;
  phoneNumber?: string;
  latitude?: number;
  longitude?: number;
}) {
  await setDoc(
    driverRef(input.uid),
    compactFirestoreData({
      id: input.uid,
      authUid: input.uid,
      email: input.email?.trim().toLowerCase() || '',
      fullName: input.fullName?.trim() || 'DoorDrop driver',
      phoneNumber: input.phoneNumber?.trim() || '',
      appOpenCount: increment(1),
      lastActiveAt: serverTimestamp(),
      currentLatitude: input.latitude,
      currentLongitude: input.longitude,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    }),
    { merge: true }
  );
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

export async function updateDriverLocation(driverId: string, location: UpdateDriverLocationInput) {
  const driverSnapshot = await getDoc(driverRef(driverId));

  if (!driverSnapshot.exists()) {
    throw new Error('Driver profile was not found.');
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

export async function updateDriverOrderStatus(driverId: string, orderId: string, status: DeliveryOrderStatus) {
  const [orderSnapshot, driverSnapshot] = await Promise.all([getDoc(orderRef(orderId)), getDoc(driverRef(driverId))]);

  if (!orderSnapshot.exists()) {
    throw new Error('Order was not found.');
  }

  if (!driverSnapshot.exists()) {
    throw new Error('Driver profile was not found.');
  }

  const order = { id: orderSnapshot.id, ...(orderSnapshot.data() as Omit<DeliveryOrder, 'id'>) };
  if (order.driverId !== driverId) {
    throw new Error('This order is assigned to a different driver.');
  }

  const batch = writeBatch(db);

  if (status === 'pending_assignment') {
    batch.update(orderRef(orderId), {
      status,
      updatedAt: serverTimestamp(),
      ...clearDriverAssignmentFields(),
    });

    batch.update(driverRef(driverId), {
      isAvailable: true,
      currentOrderId: '',
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return;
  }

  batch.update(orderRef(orderId), {
    status,
    updatedAt: serverTimestamp(),
  });

  if (status === 'delivered' || status === 'cancelled') {
    batch.update(driverRef(driverId), {
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
    status,
    driverName: order.driverName,
  });
}

export function sortDriverFleet(items: DriverRecord[]) {
  return sortDrivers(items);
}
