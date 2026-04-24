import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

import { adminWebsiteConfig, firebaseConfig } from './firebase-config.js';

const DELIVERY_STATUS_LABELS = {
  pending_assignment: 'Waiting for driver',
  driver_assigned: 'Driver assigned',
  driver_at_pickup: 'Driver at pickup',
  in_transit: 'In transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const ACTIVE_ORDER_STATUSES = ['pending_assignment', 'driver_assigned', 'driver_at_pickup', 'in_transit'];
const HISTORY_STATUSES = ['delivered', 'cancelled'];
const ASSIGNMENT_FILTERS = [
  { key: 'all', label: 'All orders' },
  { key: 'pending', label: 'Need driver' },
  { key: 'moving', label: 'In motion' },
  { key: 'history', label: 'Completed' },
];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const ordersCollection = collection(db, 'orders');
const driversCollection = collection(db, 'drivers');
const usersCollection = collection(db, 'users');
const userNotificationsCollection = collection(db, 'userNotifications');

setPersistence(auth, browserLocalPersistence).catch(() => null);

const $ = (id) => document.getElementById(id);

const elements = {
  authScreen: $('authScreen'),
  appScreen: $('appScreen'),
  loginModeButton: $('loginModeButton'),
  registerModeButton: $('registerModeButton'),
  authTitle: $('authTitle'),
  authSubtitle: $('authSubtitle'),
  authFeedback: $('authFeedback'),
  authForm: $('authForm'),
  nameField: $('nameField'),
  nameInput: $('nameInput'),
  emailInput: $('emailInput'),
  passwordInput: $('passwordInput'),
  confirmField: $('confirmField'),
  confirmPasswordInput: $('confirmPasswordInput'),
  authSubmitButton: $('authSubmitButton'),
  authNote: $('authNote'),
  signOutButton: $('signOutButton'),
  searchInput: $('searchInput'),
  syncBadge: $('syncBadge'),
  userBadge: $('userBadge'),
  feedbackBanner: $('feedbackBanner'),
  operationsPage: $('operationsPage'),
  historyPage: $('historyPage'),
  dataPage: $('dataPage'),
  overviewSummary: $('overviewSummary'),
  overviewPills: $('overviewPills'),
  overviewMetrics: $('overviewMetrics'),
  statusBoard: $('statusBoard'),
  assignmentFilters: $('assignmentFilters'),
  assignmentOrders: $('assignmentOrders'),
  selectedOrderDetails: $('selectedOrderDetails'),
  assignmentDrivers: $('assignmentDrivers'),
  priorityOrders: $('priorityOrders'),
  readyDrivers: $('readyDrivers'),
  operationsMap: $('operationsMap'),
  operationsMapLegend: $('operationsMapLegend'),
  historySummary: $('historySummary'),
  historyPills: $('historyPills'),
  historyMetrics: $('historyMetrics'),
  historyList: $('historyList'),
  historyInsights: $('historyInsights'),
  dataSummary: $('dataSummary'),
  dataPills: $('dataPills'),
  dataMetrics: $('dataMetrics'),
  overviewRevenue: $('overviewRevenue'),
  overviewActivity: $('overviewActivity'),
  dataServices: $('dataServices'),
  dataCustomers: $('dataCustomers'),
  dataFleet: $('dataFleet'),
};

const state = {
  authMode: 'login',
  user: null,
  page: 'operations',
  query: '',
  assignmentFilter: 'all',
  selectedOrderId: '',
  orders: [],
  drivers: [],
  users: [],
  loading: {
    orders: true,
    drivers: true,
    users: true,
  },
  busyOrderId: '',
  feedbackTimer: null,
  unsubscribeOrders: null,
  unsubscribeDrivers: null,
  unsubscribeUsers: null,
  lastOrderCount: 0,
};

let operationsMap = null;
let operationsMapLayer = null;

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeEmail(value) {
  return normalizeText(value);
}

function valueOrFallback(value, fallback) {
  const text = String(value || '').trim();
  return text || fallback;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function compactFirestoreData(payload) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

function parseAmount(value) {
  const numeric = Number(String(value || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatMoney(amount) {
  const currencyLabel = adminWebsiteConfig.currencyLabel || 'TZS';
  return `${currencyLabel} ${Math.max(0, Math.round(amount)).toLocaleString('en-US')}`;
}

function toMillis(value) {
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

function formatDateTime(value) {
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

function formatPercent(value) {
  return `${Math.round(Math.max(0, value) * 100)}%`;
}

function isToday(value) {
  const millis = toMillis(value);
  if (!millis) {
    return false;
  }

  const target = new Date(millis);
  const now = new Date();
  return (
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate()
  );
}

function isActiveToday(value) {
  const millis = toMillis(value);
  return millis && Date.now() - millis < 1000 * 60 * 60 * 24;
}

function sortOrders(items) {
  return [...items].sort((left, right) => toMillis(right.updatedAt ?? right.createdAt) - toMillis(left.updatedAt ?? left.createdAt));
}

function sortDrivers(items) {
  return [...items].sort((left, right) => {
    const leftBusy = !!left.currentOrderId;
    const rightBusy = !!right.currentOrderId;

    if (leftBusy !== rightBusy) {
      return leftBusy ? 1 : -1;
    }

    if (left.isAvailable !== right.isAvailable) {
      return left.isAvailable ? -1 : 1;
    }

    return valueOrFallback(left.fullName, left.email).localeCompare(valueOrFallback(right.fullName, right.email));
  });
}

function sortUsers(items) {
  return [...items].sort((left, right) => {
    return toMillis(right.lastActiveAt ?? right.updatedAt ?? right.createdAt) - toMillis(left.lastActiveAt ?? left.updatedAt ?? left.createdAt);
  });
}

function getSnapshotItems(snapshotDocs) {
  return snapshotDocs.map((item) => ({ id: item.id, ...item.data() }));
}

function matchesQuery(fields) {
  const query = normalizeText(state.query);
  if (!query) {
    return true;
  }

  return fields.filter(Boolean).join(' ').toLowerCase().includes(query);
}

function orderMatchesQuery(order) {
  return matchesQuery([
    order.orderNumber,
    order.customerName,
    order.customerPhone,
    order.customerEmail,
    order.recipientName,
    order.pickupLabel,
    order.dropoffLabel,
    order.driverName,
    order.serviceLabel,
    order.status,
    order.totalLabel,
    order.flow,
  ]);
}

function driverMatchesQuery(driver) {
  return matchesQuery([driver.fullName, driver.phoneNumber, driver.email, driver.vehicleLabel, driver.plateNumber]);
}

function userMatchesQuery(user) {
  return matchesQuery([user.fullName, user.email, user.phoneNumber, user.uid, user.id]);
}

function getStatusTone(status) {
  if (status === 'delivered') {
    return 'tone-success';
  }
  if (status === 'cancelled') {
    return 'tone-danger';
  }
  if (status === 'pending_assignment') {
    return 'tone-warning';
  }
  return 'tone-info';
}

function getDriverStatus(driver) {
  if (driver.currentOrderId) {
    return { label: 'Busy', tone: 'tone-info' };
  }
  if (driver.isAvailable) {
    return { label: 'Online', tone: 'tone-success' };
  }
  return { label: 'Offline', tone: 'tone-neutral' };
}

function renderStatusPill(label, tone = 'tone-neutral') {
  return `<span class="status-pill ${tone}">${escapeHtml(label)}</span>`;
}

function renderMetricCards(target, items) {
  target.innerHTML = items
    .map(
      (item) => `
        <article class="metric-card">
          <span class="metric-label">${escapeHtml(item.label)}</span>
          <span class="metric-value">${escapeHtml(item.value)}</span>
          ${item.note ? `<span class="metric-sub">${escapeHtml(item.note)}</span>` : ''}
        </article>
      `
    )
    .join('');
}

function renderStack(target, markup, fallback) {
  target.innerHTML = markup || `<div class="empty-state">${escapeHtml(fallback)}</div>`;
}

function renderHeroPills(target, items) {
  target.innerHTML = items
    .filter(Boolean)
    .map((label) => `<span class="hero-pill">${escapeHtml(label)}</span>`)
    .join('');
}

function setFeedback(message, type = 'info') {
  clearTimeout(state.feedbackTimer);
  const target = state.user ? elements.feedbackBanner : elements.authFeedback;
  const otherTarget = state.user ? elements.authFeedback : elements.feedbackBanner;

  otherTarget.className = 'feedback-banner hidden';
  otherTarget.textContent = '';

  if (!message) {
    target.className = 'feedback-banner hidden';
    target.textContent = '';
    return;
  }

  target.className = `feedback-banner ${type}`;
  target.textContent = message;
  state.feedbackTimer = window.setTimeout(() => {
    target.className = 'feedback-banner hidden';
    target.textContent = '';
  }, 5000);
}

function browserNotify(title, body) {
  if (!('Notification' in window)) {
    return;
  }

  if (Notification.permission === 'granted') {
    new Notification(title, { body });
    return;
  }

  if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        new Notification(title, { body });
      }
    });
  }
}

function renderAuthMode() {
  const isRegister = state.authMode === 'register';
  elements.loginModeButton.classList.toggle('active', !isRegister);
  elements.registerModeButton.classList.toggle('active', isRegister);
  elements.nameField.classList.toggle('hidden', !isRegister);
  elements.confirmField.classList.toggle('hidden', !isRegister);
  elements.passwordInput.autocomplete = isRegister ? 'new-password' : 'current-password';
  elements.authTitle.textContent = isRegister ? 'Register admin account' : 'Sign in to DoorDrop admin';
  elements.authSubtitle.textContent = isRegister
    ? 'Create an admin account using the same Firebase project used by DoorDrop and DoorDrive.'
    : 'Enter your Firebase email and password to open the live admin dashboard.';
  elements.authSubmitButton.textContent = isRegister ? 'Create account' : 'Sign in';
  elements.authNote.textContent = isRegister
    ? 'Enter full name, email, and password with at least 6 characters.'
    : 'Switch to register if you need a new admin account.';
}

function renderSession() {
  const signedIn = !!state.user;
  elements.authScreen.classList.toggle('hidden', signedIn);
  elements.appScreen.classList.toggle('hidden', !signedIn);
  elements.userBadge.classList.toggle('hidden', !signedIn);
}

function renderTopbar() {
  if (!state.user) {
    return;
  }

  elements.userBadge.textContent = state.user.displayName || state.user.email || 'Admin user';

  const loading = state.loading.orders || state.loading.drivers || state.loading.users;
  elements.syncBadge.className = loading ? 'status-pill tone-neutral' : 'status-pill tone-success';
  elements.syncBadge.textContent = loading
    ? `Syncing ${adminWebsiteConfig.projectLabel}...`
    : `Connected to ${adminWebsiteConfig.projectLabel}`;
}

function renderPageSwitch() {
  document.querySelectorAll('.nav-button').forEach((button) => {
    button.classList.toggle('active', button.dataset.page === state.page);
  });

  elements.operationsPage.classList.toggle('hidden', state.page !== 'operations');
  elements.historyPage.classList.toggle('hidden', state.page !== 'history');
  elements.dataPage.classList.toggle('hidden', state.page !== 'data');

  if (state.page === 'operations' && operationsMap) {
    requestAnimationFrame(() => operationsMap.invalidateSize());
  }
}

function getServicePerformance(orders) {
  const services = new Map();

  orders.forEach((order) => {
    const key = valueOrFallback(order.serviceLabel || order.flow, 'Delivery');
    const current = services.get(key) || {
      label: key,
      orderCount: 0,
      deliveredCount: 0,
      cancelledCount: 0,
      totalValue: 0,
      deliveredRevenue: 0,
      pipelineValue: 0,
    };

    const amount = parseAmount(order.totalLabel);
    current.orderCount += 1;
    current.totalValue += amount;

    if (order.status === 'delivered') {
      current.deliveredCount += 1;
      current.deliveredRevenue += amount;
    }

    if (order.status === 'cancelled') {
      current.cancelledCount += 1;
    }

    if (ACTIVE_ORDER_STATUSES.includes(order.status)) {
      current.pipelineValue += amount;
    }

    services.set(key, current);
  });

  return [...services.values()].sort((left, right) => {
    if (right.deliveredRevenue !== left.deliveredRevenue) {
      return right.deliveredRevenue - left.deliveredRevenue;
    }
    if (right.pipelineValue !== left.pipelineValue) {
      return right.pipelineValue - left.pipelineValue;
    }
    return right.orderCount - left.orderCount;
  });
}

function getAnalytics() {
  const totalOrders = state.orders.length;
  const pendingAssignmentOrders = state.orders.filter((order) => order.status === 'pending_assignment');
  const inMotionOrders = state.orders.filter((order) => ['driver_assigned', 'driver_at_pickup', 'in_transit'].includes(order.status));
  const deliveredOrders = state.orders.filter((order) => order.status === 'delivered');
  const cancelledOrders = state.orders.filter((order) => order.status === 'cancelled');
  const readyDrivers = state.drivers.filter((driver) => driver.isAvailable && !driver.currentOrderId);
  const busyDrivers = state.drivers.filter((driver) => !!driver.currentOrderId);
  const offlineDrivers = state.drivers.filter((driver) => !driver.isAvailable && !driver.currentOrderId);
  const activeUsers = state.users.filter((user) => isActiveToday(user.lastActiveAt || user.updatedAt || user.createdAt));
  const deliveredTodayOrders = deliveredOrders.filter((order) => isToday(order.updatedAt || order.createdAt));
  const deliveredRevenue = deliveredOrders.reduce((sum, order) => sum + parseAmount(order.totalLabel), 0);
  const deliveredTodayRevenue = deliveredTodayOrders.reduce((sum, order) => sum + parseAmount(order.totalLabel), 0);
  const activePipelineValue = state.orders
    .filter((order) => ACTIVE_ORDER_STATUSES.includes(order.status))
    .reduce((sum, order) => sum + parseAmount(order.totalLabel), 0);
  const pendingAssignmentValue = pendingAssignmentOrders.reduce((sum, order) => sum + parseAmount(order.totalLabel), 0);
  const cancelledValue = cancelledOrders.reduce((sum, order) => sum + parseAmount(order.totalLabel), 0);
  const totalAppOpens =
    state.users.reduce((sum, user) => sum + Number(user.appOpenCount || 0), 0) +
    state.drivers.reduce((sum, driver) => sum + Number(driver.appOpenCount || 0), 0);
  const completionBase = deliveredOrders.length + cancelledOrders.length;
  const completionRate = completionBase ? deliveredOrders.length / completionBase : 0;
  const driverUtilization = state.drivers.length ? busyDrivers.length / state.drivers.length : 0;

  return {
    totalOrders,
    pendingAssignmentOrders,
    inMotionOrders,
    deliveredOrders,
    cancelledOrders,
    readyDrivers,
    busyDrivers,
    offlineDrivers,
    activeUsers,
    deliveredTodayOrders,
    deliveredRevenue,
    deliveredTodayRevenue,
    activePipelineValue,
    pendingAssignmentValue,
    cancelledValue,
    totalAppOpens,
    completionRate,
    driverUtilization,
    topServices: getServicePerformance(state.orders),
  };
}

function getVisibleAssignmentOrders() {
  return sortOrders(
    state.orders
      .filter((order) => {
        if (state.assignmentFilter === 'pending') {
          return order.status === 'pending_assignment';
        }
        if (state.assignmentFilter === 'moving') {
          return ['driver_assigned', 'driver_at_pickup', 'in_transit'].includes(order.status);
        }
        if (state.assignmentFilter === 'history') {
          return HISTORY_STATUSES.includes(order.status);
        }
        return true;
      })
      .filter(orderMatchesQuery)
  );
}

function ensureSelectedOrder() {
  const visibleOrders = getVisibleAssignmentOrders();
  if (!visibleOrders.length) {
    state.selectedOrderId = '';
    return null;
  }

  const currentOrder = visibleOrders.find((order) => order.id === state.selectedOrderId);
  if (currentOrder) {
    return currentOrder;
  }

  state.selectedOrderId = visibleOrders[0].id;
  return visibleOrders[0];
}

function getAssignableDrivers(order) {
  if (!order) {
    return [];
  }

  return sortDrivers(
    state.drivers.filter((driver) => {
      if (driver.id === order.driverId) {
        return true;
      }

      if (!driverMatchesQuery(driver)) {
        return false;
      }

      return driver.isAvailable && !driver.currentOrderId;
    })
  );
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

function buildDriverAssignmentPayload(driver) {
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

function orderRef(orderId) {
  return doc(db, 'orders', orderId);
}

function driverRef(driverId) {
  return doc(db, 'drivers', driverId);
}

async function canSendOrderNotification(userId) {
  if (!userId) {
    return false;
  }

  try {
    const userSnapshot = await getDoc(doc(usersCollection, userId));
    const preferences = userSnapshot.data()?.notificationPreferences;
    return preferences?.orderUpdates !== false;
  } catch {
    return true;
  }
}

function getOrderStatusNotificationCopy(input) {
  if (input.status === 'pending_assignment') {
    return {
      title: 'Order received',
      message: `${input.orderNumber} is in dispatch and waiting for the best available driver.`,
    };
  }

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

  const reasonText = input.cancellationReason?.trim() ? ` Reason: ${input.cancellationReason.trim()}.` : '';
  const actorPrefix =
    input.cancelledBy === 'customer'
      ? 'You cancelled'
      : input.cancelledBy === 'driver'
        ? 'The driver cancelled'
        : 'DoorDrop dispatch cancelled';

  return {
    title: 'Order cancelled',
    message: `${actorPrefix} ${input.orderNumber}.${reasonText}${reasonText ? '' : ' Contact support if this was unexpected.'}`,
  };
}

async function createOrderStatusNotification(input) {
  if (!input.userId) {
    return;
  }

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

async function assignDriverToOrder(orderId, driverId) {
  const [orderSnapshot, driverSnapshot] = await Promise.all([getDoc(orderRef(orderId)), getDoc(driverRef(driverId))]);

  if (!orderSnapshot.exists()) {
    throw new Error('Order was not found.');
  }

  if (!driverSnapshot.exists()) {
    throw new Error('Driver was not found.');
  }

  const order = { id: orderSnapshot.id, ...orderSnapshot.data() };
  const driver = { id: driverSnapshot.id, ...driverSnapshot.data() };

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

  batch.update(
    orderRef(orderId),
    compactFirestoreData({
      status: 'driver_assigned',
      ...buildDriverAssignmentPayload(driver),
      cancellationReason: deleteField(),
      cancelledBy: deleteField(),
      cancelledAt: deleteField(),
      assignedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  batch.update(driverRef(driver.id), {
    isAvailable: false,
    currentOrderId: orderId,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  await createOrderStatusNotification({
    userId: order.userId,
    orderId,
    orderNumber: valueOrFallback(order.orderNumber, orderId),
    serviceLabel: order.serviceLabel,
    status: 'driver_assigned',
    driverName: driver.fullName,
  });
}

async function unassignDriverFromOrder(orderId) {
  const orderSnapshot = await getDoc(orderRef(orderId));
  if (!orderSnapshot.exists()) {
    throw new Error('Order was not found.');
  }

  const order = { id: orderSnapshot.id, ...orderSnapshot.data() };
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
    orderId,
    orderNumber: valueOrFallback(order.orderNumber, orderId),
    serviceLabel: order.serviceLabel,
    status: 'pending_assignment',
  });
}

async function updateDeliveryOrderStatus(orderId, status) {
  if (status === 'pending_assignment') {
    await unassignDriverFromOrder(orderId);
    return;
  }

  const orderSnapshot = await getDoc(orderRef(orderId));
  if (!orderSnapshot.exists()) {
    throw new Error('Order was not found.');
  }

  const order = { id: orderSnapshot.id, ...orderSnapshot.data() };
  if (order.status === status) {
    return;
  }

  if (!order.driverId && ['driver_assigned', 'driver_at_pickup', 'in_transit', 'delivered'].includes(status)) {
    throw new Error('Assign a driver before moving this order forward.');
  }

  const batch = writeBatch(db);
  const orderPayload = {
    status,
    updatedAt: serverTimestamp(),
    cancellationReason: status === 'cancelled' ? valueOrFallback(order.cancellationReason, 'Cancelled by dispatch') : deleteField(),
    cancelledBy: status === 'cancelled' ? 'dispatch' : deleteField(),
    cancelledAt: status === 'cancelled' ? serverTimestamp() : deleteField(),
  };

  batch.update(orderRef(orderId), compactFirestoreData(orderPayload));

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
    orderId,
    orderNumber: valueOrFallback(order.orderNumber, orderId),
    serviceLabel: order.serviceLabel,
    status,
    driverName: order.driverName,
    cancellationReason: status === 'cancelled' ? valueOrFallback(order.cancellationReason, 'Cancelled by dispatch') : undefined,
    cancelledBy: status === 'cancelled' ? 'dispatch' : undefined,
  });
}

function renderAssignmentFilters() {
  elements.assignmentFilters.innerHTML = ASSIGNMENT_FILTERS.map((filter) => {
    const activeClass = state.assignmentFilter === filter.key ? 'active' : '';
    return `<button class="chip ${activeClass}" type="button" data-filter="${filter.key}">${escapeHtml(filter.label)}</button>`;
  }).join('');
}

function renderSelectedOrderDetails(order) {
  if (!order) {
    renderStack(elements.selectedOrderDetails, '', 'Select an order from the queue to review details and update it.');
    return;
  }

  const busy = state.busyOrderId === order.id;
  const statusActions = ['pending_assignment', 'driver_assigned', 'driver_at_pickup', 'in_transit', 'delivered', 'cancelled'];

  elements.selectedOrderDetails.innerHTML = `
    <article class="detail-card">
      <div class="list-item" style="cursor:default;">
        <div>
          <span class="list-item-id">${escapeHtml(valueOrFallback(order.orderNumber, order.id))}</span>
          <span class="list-item-meta">${escapeHtml(valueOrFallback(order.serviceLabel, 'Delivery'))}</span>
        </div>
        ${renderStatusPill(DELIVERY_STATUS_LABELS[order.status] || valueOrFallback(order.status, 'Pending'), getStatusTone(order.status))}
      </div>

      <div class="detail-grid">
        <div><strong>Customer</strong><p>${escapeHtml(valueOrFallback(order.customerName, 'Customer'))}</p></div>
        <div><strong>Contact</strong><p>${escapeHtml(valueOrFallback(order.customerPhone || order.customerEmail, 'Not provided'))}</p></div>
        <div><strong>Pickup</strong><p>${escapeHtml(valueOrFallback(order.pickupLabel, 'Pickup pending'))}</p></div>
        <div><strong>Drop-off</strong><p>${escapeHtml(valueOrFallback(order.dropoffLabel, 'Drop-off pending'))}</p></div>
        <div><strong>Recipient</strong><p>${escapeHtml(valueOrFallback(order.recipientName, 'Recipient pending'))}</p></div>
        <div><strong>Schedule</strong><p>${escapeHtml(valueOrFallback(order.scheduleLabel, 'Immediate dispatch'))}</p></div>
        <div><strong>Value</strong><p>${escapeHtml(valueOrFallback(order.totalLabel, formatMoney(parseAmount(order.totalLabel))))}</p></div>
        <div><strong>Driver</strong><p>${escapeHtml(valueOrFallback(order.driverName, 'No driver assigned'))}</p></div>
        <div><strong>Vehicle</strong><p>${escapeHtml(valueOrFallback(order.driverVehicleLabel, 'Vehicle pending'))}</p></div>
        <div><strong>Plate</strong><p>${escapeHtml(valueOrFallback(order.driverPlateNumber, 'Plate pending'))}</p></div>
        <div><strong>Flow</strong><p>${escapeHtml(valueOrFallback(order.flow, 'delivery'))}</p></div>
        <div><strong>Updated</strong><p>${escapeHtml(formatDateTime(order.updatedAt || order.createdAt))}</p></div>
      </div>

      <div>
        <p class="eyebrow">Update status</p>
        <div class="chip-row">
          ${statusActions
            .map((status) => {
              const activeClass = order.status === status ? 'active' : '';
              return `
                <button
                  class="chip ${activeClass}"
                  type="button"
                  data-status-order="${escapeHtml(order.id)}"
                  data-status="${escapeHtml(status)}"
                  ${busy ? 'disabled' : ''}
                >
                  ${escapeHtml(DELIVERY_STATUS_LABELS[status])}
                </button>
              `;
            })
            .join('')}
        </div>
      </div>
    </article>
  `;
}

function renderAssignmentDrivers(order) {
  if (!order) {
    renderStack(elements.assignmentDrivers, '', 'Select an order first to see drivers ready for assignment.');
    return;
  }

  const drivers = getAssignableDrivers(order);
  const busy = state.busyOrderId === order.id;

  const markup = drivers
    .map((driver) => {
      const status = getDriverStatus(driver);
      const assigned = order.driverId === driver.id;

      return `
        <article class="list-item" style="cursor:default;">
          <div>
            <span class="list-item-id">${escapeHtml(valueOrFallback(driver.fullName, 'Driver'))}</span>
            <span class="list-item-meta">${escapeHtml(valueOrFallback(driver.vehicleLabel, 'Vehicle pending'))} • ${escapeHtml(valueOrFallback(driver.phoneNumber, 'Phone pending'))}</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            ${renderStatusPill(status.label, status.tone)}
            <button
              class="button ${assigned ? 'secondary' : 'primary'}"
              type="button"
              data-assign-order="${escapeHtml(order.id)}"
              data-assign-driver="${escapeHtml(driver.id)}"
              ${busy ? 'disabled' : ''}
            >
              ${assigned ? 'Assigned' : 'Assign'}
            </button>
          </div>
        </article>
      `;
    })
    .join('');

  renderStack(elements.assignmentDrivers, markup, 'No driver is available for the selected order right now.');
}

function ensureOperationsMap() {
  if (!elements.operationsMap || !window.L) {
    return null;
  }

  if (!operationsMap) {
    operationsMap = window.L.map(elements.operationsMap, {
      zoomControl: false,
      attributionControl: true,
    }).setView([-6.7924, 39.2083], 12);

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(operationsMap);

    window.L.control.zoom({ position: 'bottomright' }).addTo(operationsMap);
    operationsMapLayer = window.L.layerGroup().addTo(operationsMap);
  }

  return window.L;
}

function createMapPoint(latitude, longitude, label, tone) {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng, label, tone };
}

function renderOperationsMap(selectedOrder, analytics) {
  if (state.loading.orders || state.loading.drivers) {
    elements.operationsMapLegend.innerHTML = '<div class="empty-state">Waiting for order and driver coordinates from Firebase.</div>';
    return;
  }

  const leaflet = ensureOperationsMap();
  if (!leaflet || !operationsMapLayer) {
    elements.operationsMapLegend.innerHTML = '<div class="empty-state">Leaflet map is not available in this browser session.</div>';
    return;
  }

  operationsMapLayer.clearLayers();

  const selectedPoints = selectedOrder
    ? [
        createMapPoint(selectedOrder.pickupLatitude, selectedOrder.pickupLongitude, `Pickup • ${valueOrFallback(selectedOrder.orderNumber, selectedOrder.id)}`, 'orange'),
        createMapPoint(selectedOrder.dropoffLatitude, selectedOrder.dropoffLongitude, `Drop-off • ${valueOrFallback(selectedOrder.orderNumber, selectedOrder.id)}`, 'red'),
        createMapPoint(selectedOrder.driverLatitude, selectedOrder.driverLongitude, `Driver • ${valueOrFallback(selectedOrder.driverName, 'Assigned driver')}`, 'blue'),
      ].filter(Boolean)
    : [];

  const driverPoints = state.drivers
    .map((driver) =>
      createMapPoint(
        driver.currentLatitude,
        driver.currentLongitude,
        valueOrFallback(driver.fullName, 'Driver'),
        driver.currentOrderId ? 'blue' : 'green'
      )
    )
    .filter(Boolean);

  const allPoints = [...selectedPoints, ...driverPoints];
  const pointStyles = {
    orange: { fillColor: '#f59e0b' },
    red: { fillColor: '#ef4444' },
    blue: { fillColor: '#2563eb' },
    green: { fillColor: '#10b981' },
  };

  allPoints.forEach((point) => {
    const style = pointStyles[point.tone] || pointStyles.blue;
    leaflet
      .circleMarker([point.lat, point.lng], {
        radius: 7,
        color: '#ffffff',
        weight: 2,
        fillColor: style.fillColor,
        fillOpacity: 0.92,
      })
      .bindTooltip(escapeHtml(point.label))
      .addTo(operationsMapLayer);
  });

  if (selectedPoints.length >= 2) {
    leaflet
      .polyline(
        selectedPoints.slice(0, 2).map((point) => [point.lat, point.lng]),
        {
          color: '#10b981',
          weight: 3,
          opacity: 0.85,
          dashArray: '8 8',
        }
      )
      .addTo(operationsMapLayer);
  }

  if (allPoints.length) {
    operationsMap.fitBounds(
      leaflet.latLngBounds(allPoints.map((point) => [point.lat, point.lng])),
      { padding: [20, 20], maxZoom: 13 }
    );
  } else {
    operationsMap.setView([-6.7924, 39.2083], 12);
  }

  elements.operationsMapLegend.innerHTML = `
    <div class="chip-row">
      <span class="hero-pill">Selected route: ${selectedPoints.length}</span>
      <span class="hero-pill">Busy drivers: ${analytics.busyDrivers.length}</span>
      <span class="hero-pill">Ready drivers: ${analytics.readyDrivers.length}</span>
      <span class="hero-pill">Map points: ${allPoints.length}</span>
    </div>
  `;
}

function renderOperations() {
  const analytics = getAnalytics();

  if (state.loading.orders || state.loading.drivers) {
    elements.overviewSummary.textContent = 'Loading live DoorDrop and DoorDrive operations from Firebase...';
    elements.overviewPills.innerHTML = '';
    renderMetricCards(elements.overviewMetrics, [
      { label: 'Need driver', value: '...', note: 'Loading order queue' },
      { label: 'In motion', value: '...', note: 'Loading active trips' },
      { label: 'Delivered', value: '...', note: 'Loading outcomes' },
      { label: 'Riders ready', value: '...', note: 'Loading fleet' },
    ]);
    renderStack(elements.statusBoard, '', 'Preparing order status board...');
    renderStack(elements.assignmentOrders, '', 'Loading orders queue...');
    renderStack(elements.selectedOrderDetails, '', 'Preparing selected order view...');
    renderStack(elements.assignmentDrivers, '', 'Loading drivers...');
    renderStack(elements.priorityOrders, '', 'Loading priority orders...');
    renderStack(elements.readyDrivers, '', 'Loading available drivers...');
    renderOperationsMap(null, analytics);
    return;
  }

  elements.overviewSummary.textContent = `${analytics.pendingAssignmentOrders.length} orders need a driver, ${analytics.inMotionOrders.length} are moving, ${analytics.readyDrivers.length} riders are ready, and ${formatMoney(analytics.deliveredTodayRevenue)} has already been delivered today.`;
  renderHeroPills(elements.overviewPills, [
    `${analytics.totalOrders} total orders`,
    `${analytics.readyDrivers.length} riders ready`,
    `${analytics.busyDrivers.length} riders busy`,
    `${analytics.deliveredOrders.length} delivered`,
  ]);

  renderMetricCards(elements.overviewMetrics, [
    { label: 'Need driver', value: String(analytics.pendingAssignmentOrders.length), note: 'Waiting for assignment' },
    { label: 'In motion', value: String(analytics.inMotionOrders.length), note: 'Assigned, pickup, transit' },
    { label: 'Delivered', value: String(analytics.deliveredOrders.length), note: formatMoney(analytics.deliveredRevenue) },
    { label: 'Riders ready', value: String(analytics.readyDrivers.length), note: 'Available for dispatch' },
  ]);

  elements.statusBoard.innerHTML = [
    { label: 'Pending', count: analytics.pendingAssignmentOrders.length, tone: 'tone-warning' },
    { label: 'In motion', count: analytics.inMotionOrders.length, tone: 'tone-info' },
    { label: 'Delivered', count: analytics.deliveredOrders.length, tone: 'tone-success' },
    { label: 'Cancelled', count: analytics.cancelledOrders.length, tone: 'tone-danger' },
  ]
    .map(
      (item) => `
        <div class="status-board-card">
          <span class="status-dot ${item.tone}"></span>
          <span>${escapeHtml(item.label)}</span>
          <span class="status-count">${escapeHtml(String(item.count))}</span>
        </div>
      `
    )
    .join('');

  renderAssignmentFilters();

  const visibleOrders = getVisibleAssignmentOrders();
  const selectedOrder = ensureSelectedOrder();
  const ordersMarkup = visibleOrders
    .slice(0, 30)
    .map((order) => {
      const selectedClass = selectedOrder?.id === order.id ? 'selected' : '';
      return `
        <article class="list-item ${selectedClass}" data-select-order="${escapeHtml(order.id)}">
          <div>
            <span class="list-item-id">${escapeHtml(valueOrFallback(order.orderNumber, order.id))}</span>
            <span class="list-item-meta">${escapeHtml(valueOrFallback(order.customerName, 'Customer'))} • ${escapeHtml(valueOrFallback(order.serviceLabel, 'Delivery'))}</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            ${renderStatusPill(DELIVERY_STATUS_LABELS[order.status] || valueOrFallback(order.status, 'Pending'), getStatusTone(order.status))}
            <span class="list-item-value">${escapeHtml(valueOrFallback(order.totalLabel, formatMoney(parseAmount(order.totalLabel))))}</span>
          </div>
        </article>
      `;
    })
    .join('');
  renderStack(elements.assignmentOrders, ordersMarkup, 'No orders match the current filter.');

  renderSelectedOrderDetails(selectedOrder);
  renderAssignmentDrivers(selectedOrder);

  const priorityMarkup = sortOrders([...analytics.pendingAssignmentOrders, ...analytics.inMotionOrders])
    .slice(0, 6)
    .map(
      (order) => `
        <article class="list-item" style="cursor:default;">
          <div>
            <span class="list-item-id">${escapeHtml(valueOrFallback(order.orderNumber, order.id))}</span>
            <span class="list-item-meta">${escapeHtml(valueOrFallback(order.pickupLabel, 'Pickup pending'))} to ${escapeHtml(valueOrFallback(order.dropoffLabel, 'Drop-off pending'))}</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            ${renderStatusPill(DELIVERY_STATUS_LABELS[order.status] || valueOrFallback(order.status, 'Pending'), getStatusTone(order.status))}
            <span class="list-item-value">${escapeHtml(valueOrFallback(order.totalLabel, formatMoney(parseAmount(order.totalLabel))))}</span>
          </div>
        </article>
      `
    )
    .join('');
  renderStack(elements.priorityOrders, priorityMarkup, 'No orders need special attention right now.');

  const readyMarkup = analytics.readyDrivers
    .filter(driverMatchesQuery)
    .slice(0, 6)
    .map((driver) => {
      const status = getDriverStatus(driver);
      return `
        <article class="list-item" style="cursor:default;">
          <div>
            <span class="list-item-id">${escapeHtml(valueOrFallback(driver.fullName, 'Driver'))}</span>
            <span class="list-item-meta">${escapeHtml(valueOrFallback(driver.vehicleLabel, 'Vehicle pending'))} • ${escapeHtml(valueOrFallback(driver.plateNumber, 'Plate pending'))}</span>
          </div>
          ${renderStatusPill(status.label, status.tone)}
        </article>
      `;
    })
    .join('');
  renderStack(elements.readyDrivers, readyMarkup, 'No drivers are available right now.');

  renderOperationsMap(selectedOrder, analytics);
}

function renderHistory() {
  const analytics = getAnalytics();

  if (state.loading.orders) {
    elements.historySummary.textContent = 'Loading delivered and cancelled orders from Firebase...';
    elements.historyPills.innerHTML = '';
    renderMetricCards(elements.historyMetrics, [
      { label: 'Delivered', value: '...', note: 'Loading completed orders' },
      { label: 'Cancelled', value: '...', note: 'Loading cancelled orders' },
      { label: 'Revenue', value: '...', note: 'Loading totals' },
    ]);
    renderStack(elements.historyList, '', 'Loading order history...');
    renderStack(elements.historyInsights, '', 'Loading history insights...');
    return;
  }

  const historyOrders = sortOrders(state.orders.filter((order) => HISTORY_STATUSES.includes(order.status)).filter(orderMatchesQuery));
  const topService = analytics.topServices[0];
  const recentDelivered = analytics.deliveredOrders[0];

  elements.historySummary.textContent = `${analytics.deliveredOrders.length} orders have been delivered, ${analytics.cancelledOrders.length} were cancelled, and ${formatMoney(analytics.deliveredRevenue)} has been realized across completed trips.`;
  renderHeroPills(elements.historyPills, [
    `${analytics.deliveredOrders.length} delivered`,
    `${analytics.cancelledOrders.length} cancelled`,
    `${formatMoney(analytics.deliveredRevenue)} realized revenue`,
    `${analytics.deliveredTodayOrders.length} finished today`,
  ]);

  renderMetricCards(elements.historyMetrics, [
    { label: 'Delivered', value: String(analytics.deliveredOrders.length), note: 'Completed successfully' },
    { label: 'Cancelled', value: String(analytics.cancelledOrders.length), note: 'Cancelled before delivery' },
    { label: 'Revenue', value: formatMoney(analytics.deliveredRevenue), note: 'Delivered order value' },
    { label: 'Completion rate', value: formatPercent(analytics.completionRate), note: 'Delivered vs cancelled' },
  ]);

  const historyMarkup = historyOrders
    .slice(0, 18)
    .map(
      (order) => `
        <article class="list-item" style="cursor:default;">
          <div>
            <span class="list-item-id">${escapeHtml(valueOrFallback(order.orderNumber, order.id))}</span>
            <span class="list-item-meta">${escapeHtml(valueOrFallback(order.customerName, 'Customer'))} • ${escapeHtml(formatDateTime(order.updatedAt || order.createdAt))}</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            ${renderStatusPill(DELIVERY_STATUS_LABELS[order.status] || valueOrFallback(order.status, 'Pending'), getStatusTone(order.status))}
            <span class="list-item-value">${escapeHtml(valueOrFallback(order.totalLabel, formatMoney(parseAmount(order.totalLabel))))}</span>
          </div>
        </article>
      `
    )
    .join('');
  renderStack(elements.historyList, historyMarkup, 'No delivered or cancelled orders match this search.');

  const averageDeliveredValue = analytics.deliveredOrders.length ? analytics.deliveredRevenue / analytics.deliveredOrders.length : 0;
  const insightsMarkup = [
    {
      title: 'Average delivered order',
      value: formatMoney(averageDeliveredValue),
      note: 'Typical delivered order value.',
    },
    {
      title: 'Best service line',
      value: topService ? topService.label : 'No service data yet',
      note: topService
        ? `${topService.deliveredCount} delivered orders • ${formatMoney(topService.deliveredRevenue)}`
        : 'Waiting for delivered service data.',
    },
    {
      title: 'Latest delivered order',
      value: recentDelivered ? valueOrFallback(recentDelivered.orderNumber, recentDelivered.id) : 'No delivered order yet',
      note: recentDelivered ? formatDateTime(recentDelivered.updatedAt || recentDelivered.createdAt) : 'History is still empty.',
    },
  ]
    .map(
      (item) => `
        <article class="metric-card">
          <span class="metric-label">${escapeHtml(item.title)}</span>
          <span class="metric-value" style="font-size:1.1rem;">${escapeHtml(item.value)}</span>
          <span class="metric-sub">${escapeHtml(item.note)}</span>
        </article>
      `
    )
    .join('');
  renderStack(elements.historyInsights, insightsMarkup, 'No history insights are available yet.');
}

function renderData() {
  const analytics = getAnalytics();

  if (state.loading.orders || state.loading.drivers || state.loading.users) {
    elements.dataSummary.textContent = 'Loading customers, fleet, and business totals from Firebase...';
    elements.dataPills.innerHTML = '';
    renderMetricCards(elements.dataMetrics, [
      { label: 'Orders', value: '...', note: 'Loading total orders' },
      { label: 'Revenue', value: '...', note: 'Loading delivered totals' },
      { label: 'Fleet', value: '...', note: 'Loading utilization' },
      { label: 'Users', value: '...', note: 'Loading customers' },
    ]);
    renderStack(elements.overviewRevenue, '', 'Loading revenue snapshot...');
    renderStack(elements.overviewActivity, '', 'Loading activity snapshot...');
    renderStack(elements.dataServices, '', 'Loading service performance...');
    renderStack(elements.dataCustomers, '', 'Loading customer activity...');
    renderStack(elements.dataFleet, '', 'Loading fleet activity...');
    return;
  }

  const topService = analytics.topServices[0];
  const activeCustomers = state.users.filter((user) => isActiveToday(user.lastActiveAt || user.updatedAt || user.createdAt));

  elements.dataSummary.textContent = `${analytics.totalOrders} total orders are on record, ${state.users.length} customers are synced from DoorDrop, ${state.drivers.length} driver records are synced from DoorDrive, and ${activeCustomers.length} customers were active in the last day.`;
  renderHeroPills(elements.dataPills, [
    `${analytics.totalOrders} orders`,
    `${state.users.length} customers`,
    `${state.drivers.length} drivers`,
    `${analytics.totalAppOpens.toLocaleString('en-US')} app opens`,
  ]);

  renderMetricCards(elements.dataMetrics, [
    { label: 'Total orders', value: String(analytics.totalOrders), note: 'All synced Firestore orders' },
    { label: 'Delivered value', value: formatMoney(analytics.deliveredRevenue), note: 'Completed order value' },
    { label: 'Fleet utilization', value: formatPercent(analytics.driverUtilization), note: 'Busy vs total drivers' },
    { label: 'Pending value', value: formatMoney(analytics.pendingAssignmentValue), note: 'Still waiting for driver' },
  ]);

  const revenueMarkup = [
    {
      title: 'Delivered revenue',
      value: formatMoney(analytics.deliveredRevenue),
      note: 'Value realized from completed deliveries.',
    },
    {
      title: 'Active pipeline',
      value: formatMoney(analytics.activePipelineValue),
      note: 'Value moving through active delivery flow.',
    },
    {
      title: 'Top service',
      value: topService ? topService.label : 'No service leader yet',
      note: topService
        ? `${topService.orderCount} orders • ${formatMoney(topService.deliveredRevenue)} delivered revenue`
        : 'Waiting for more service activity.',
    },
  ]
    .map(
      (item) => `
        <article class="metric-card">
          <span class="metric-label">${escapeHtml(item.title)}</span>
          <span class="metric-value" style="font-size:1.1rem;">${escapeHtml(item.value)}</span>
          <span class="metric-sub">${escapeHtml(item.note)}</span>
        </article>
      `
    )
    .join('');
  renderStack(elements.overviewRevenue, revenueMarkup, 'No revenue summary is available yet.');

  const activityMarkup = [
    {
      title: 'Active customers',
      value: String(activeCustomers.length),
      note: 'Customers active in the last 24 hours.',
    },
    {
      title: 'Fleet status',
      value: `${analytics.busyDrivers.length} busy / ${analytics.readyDrivers.length} ready`,
      note: `${analytics.offlineDrivers.length} offline drivers.`,
    },
    {
      title: 'Delivered today',
      value: `${analytics.deliveredTodayOrders.length} orders`,
      note: `${formatMoney(analytics.deliveredTodayRevenue)} completed today.`,
    },
  ]
    .map(
      (item) => `
        <article class="metric-card">
          <span class="metric-label">${escapeHtml(item.title)}</span>
          <span class="metric-value" style="font-size:1.1rem;">${escapeHtml(item.value)}</span>
          <span class="metric-sub">${escapeHtml(item.note)}</span>
        </article>
      `
    )
    .join('');
  renderStack(elements.overviewActivity, activityMarkup, 'No activity summary is available yet.');

  const servicesMarkup = analytics.topServices
    .slice(0, 10)
    .map(
      (service) => `
        <article class="list-item" style="cursor:default;">
          <div>
            <span class="list-item-id">${escapeHtml(service.label)}</span>
            <span class="list-item-meta">${escapeHtml(`${service.orderCount} orders • ${service.deliveredCount} delivered • ${service.cancelledCount} cancelled`)}</span>
          </div>
          <span class="list-item-value">${escapeHtml(formatMoney(service.deliveredRevenue || service.totalValue))}</span>
        </article>
      `
    )
    .join('');
  renderStack(elements.dataServices, servicesMarkup, 'No service performance data is available yet.');

  const customersMarkup = sortUsers(state.users)
    .filter(userMatchesQuery)
    .slice(0, 12)
    .map(
      (user) => `
        <article class="list-item" style="cursor:default;">
          <div>
            <span class="list-item-id">${escapeHtml(valueOrFallback(user.fullName, valueOrFallback(user.email, 'Customer')))}</span>
            <span class="list-item-meta">${escapeHtml(valueOrFallback(user.email, 'Email pending'))} • ${escapeHtml(valueOrFallback(user.phoneNumber, 'Phone pending'))}</span>
          </div>
          ${renderStatusPill(isActiveToday(user.lastActiveAt || user.updatedAt || user.createdAt) ? 'Active' : 'Quiet', isActiveToday(user.lastActiveAt || user.updatedAt || user.createdAt) ? 'tone-success' : 'tone-neutral')}
        </article>
      `
    )
    .join('');
  renderStack(elements.dataCustomers, customersMarkup, 'No customer data matches this search.');

  const fleetMarkup = sortDrivers(state.drivers)
    .filter(driverMatchesQuery)
    .slice(0, 12)
    .map((driver) => {
      const status = getDriverStatus(driver);
      return `
        <article class="list-item" style="cursor:default;">
          <div>
            <span class="list-item-id">${escapeHtml(valueOrFallback(driver.fullName, 'Driver'))}</span>
            <span class="list-item-meta">${escapeHtml(valueOrFallback(driver.vehicleLabel, 'Vehicle pending'))} • ${escapeHtml(valueOrFallback(driver.plateNumber, 'Plate pending'))}</span>
          </div>
          ${renderStatusPill(status.label, status.tone)}
        </article>
      `;
    })
    .join('');
  renderStack(elements.dataFleet, fleetMarkup, 'No fleet data matches this search.');
}

function renderAll() {
  renderAuthMode();
  renderSession();

  if (!state.user) {
    return;
  }

  renderTopbar();
  renderPageSwitch();
  renderOperations();
  renderHistory();
  renderData();
}

function stopSubscriptions() {
  if (typeof state.unsubscribeOrders === 'function') {
    state.unsubscribeOrders();
  }
  if (typeof state.unsubscribeDrivers === 'function') {
    state.unsubscribeDrivers();
  }
  if (typeof state.unsubscribeUsers === 'function') {
    state.unsubscribeUsers();
  }

  state.unsubscribeOrders = null;
  state.unsubscribeDrivers = null;
  state.unsubscribeUsers = null;
}

function startSubscriptions() {
  stopSubscriptions();

  state.loading.orders = true;
  state.loading.drivers = true;
  state.loading.users = true;
  renderAll();

  state.unsubscribeOrders = onSnapshot(
    ordersCollection,
    (snapshot) => {
      const nextOrders = sortOrders(getSnapshotItems(snapshot.docs));
      if (state.lastOrderCount && snapshot.size > state.lastOrderCount) {
        const latest = nextOrders[0];
        browserNotify('New order received', valueOrFallback(latest?.customerName, 'A new DoorDrop order arrived.'));
        setFeedback('A new DoorDrop order arrived.', 'info');
      }

      state.orders = nextOrders;
      state.loading.orders = false;
      state.lastOrderCount = snapshot.size;
      renderAll();
    },
    (error) => {
      state.loading.orders = false;
      setFeedback(`Orders listener error: ${error.message}`, 'error');
      renderAll();
    }
  );

  state.unsubscribeDrivers = onSnapshot(
    driversCollection,
    (snapshot) => {
      state.drivers = sortDrivers(getSnapshotItems(snapshot.docs));
      state.loading.drivers = false;
      renderAll();
    },
    (error) => {
      state.loading.drivers = false;
      setFeedback(`Drivers listener error: ${error.message}`, 'error');
      renderAll();
    }
  );

  state.unsubscribeUsers = onSnapshot(
    usersCollection,
    (snapshot) => {
      state.users = sortUsers(getSnapshotItems(snapshot.docs));
      state.loading.users = false;
      renderAll();
    },
    (error) => {
      state.loading.users = false;
      setFeedback(`Users listener error: ${error.message}`, 'error');
      renderAll();
    }
  );
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  const isRegister = state.authMode === 'register';
  const email = normalizeEmail(elements.emailInput.value);
  const password = String(elements.passwordInput.value || '');
  const fullName = String(elements.nameInput.value || '').trim();
  const confirmPassword = String(elements.confirmPasswordInput.value || '');

  if (!/\S+@\S+\.\S+/.test(email)) {
    setFeedback('Enter a valid email address.', 'error');
    return;
  }

  if (password.length < 6) {
    setFeedback('Use a password with at least 6 characters.', 'error');
    return;
  }

  elements.authSubmitButton.disabled = true;
  elements.authSubmitButton.textContent = isRegister ? 'Creating account...' : 'Signing in...';

  try {
    if (isRegister) {
      if (!fullName) {
        throw new Error('Enter a full name before registering.');
      }
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match.');
      }

      const credential = await createUserWithEmailAndPassword(auth, email, password);
      if (credential.user) {
        await updateProfile(credential.user, { displayName: fullName }).catch(() => null);
      }
      setFeedback('Admin account created successfully.', 'success');
    } else {
      await signInWithEmailAndPassword(auth, email, password);
      setFeedback('Signed in successfully.', 'success');
    }

    elements.authForm.reset();
  } catch (error) {
    const message =
      error?.message === 'Firebase: Error (auth/email-already-in-use).'
        ? 'That email already has an account. Try logging in.'
        : error?.message === 'Firebase: Error (auth/invalid-credential).'
          ? 'The email or password is incorrect.'
          : error?.message === 'Firebase: Error (auth/invalid-email).'
            ? 'The email address is invalid.'
            : error?.message || 'Authentication failed.';
    setFeedback(message, 'error');
  } finally {
    renderAuthMode();
    elements.authSubmitButton.disabled = false;
  }
}

async function handleAssignDriver(orderId, driverId) {
  state.busyOrderId = orderId;
  renderAll();

  try {
    await assignDriverToOrder(orderId, driverId);
    setFeedback('Driver assigned successfully.', 'success');
  } catch (error) {
    setFeedback(error.message || 'Driver assignment failed.', 'error');
  } finally {
    state.busyOrderId = '';
    renderAll();
  }
}

async function handleStatusUpdate(orderId, status) {
  state.busyOrderId = orderId;
  renderAll();

  try {
    await updateDeliveryOrderStatus(orderId, status);
    setFeedback(`Order updated to ${DELIVERY_STATUS_LABELS[status].toLowerCase()}.`, 'success');
  } catch (error) {
    setFeedback(error.message || 'Order update failed.', 'error');
  } finally {
    state.busyOrderId = '';
    renderAll();
  }
}

async function handleSignOut() {
  try {
    await signOut(auth);
    setFeedback('Signed out successfully.', 'info');
  } catch (error) {
    setFeedback(error.message || 'Could not sign out right now.', 'error');
  }
}

elements.loginModeButton.addEventListener('click', () => {
  state.authMode = 'login';
  renderAuthMode();
});

elements.registerModeButton.addEventListener('click', () => {
  state.authMode = 'register';
  renderAuthMode();
});

elements.authForm.addEventListener('submit', handleAuthSubmit);
elements.signOutButton.addEventListener('click', handleSignOut);

elements.searchInput.addEventListener('input', (event) => {
  state.query = event.target.value.trim();
  renderAll();
});

document.querySelectorAll('.nav-button').forEach((button) => {
  button.addEventListener('click', () => {
    state.page = button.dataset.page;
    renderPageSwitch();
    renderAll();
  });
});

document.addEventListener('click', async (event) => {
  const filterButton = event.target.closest('#assignmentFilters [data-filter]');
  if (filterButton) {
    state.assignmentFilter = filterButton.dataset.filter;
    renderAll();
    return;
  }

  const orderCard = event.target.closest('#assignmentOrders [data-select-order]');
  if (orderCard) {
    state.selectedOrderId = orderCard.dataset.selectOrder;
    renderAll();
    return;
  }

  const assignButton = event.target.closest('#assignmentDrivers [data-assign-driver]');
  if (assignButton) {
    await handleAssignDriver(assignButton.dataset.assignOrder, assignButton.dataset.assignDriver);
    return;
  }

  const statusButton = event.target.closest('#selectedOrderDetails [data-status-order]');
  if (statusButton) {
    await handleStatusUpdate(statusButton.dataset.statusOrder, statusButton.dataset.status);
  }
});

onAuthStateChanged(auth, (user) => {
  stopSubscriptions();
  state.user = user;
  state.page = 'operations';
  state.query = '';
  state.assignmentFilter = 'all';
  state.selectedOrderId = '';
  state.lastOrderCount = 0;
  elements.searchInput.value = '';

  if (user) {
    startSubscriptions();
    renderAll();
    return;
  }

  state.orders = [];
  state.drivers = [];
  state.users = [];
  state.loading.orders = false;
  state.loading.drivers = false;
  state.loading.users = false;
  renderAll();
});

renderAuthMode();
renderSession();
