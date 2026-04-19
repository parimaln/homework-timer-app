self.addEventListener('install', () => {
  self.skipWaiting();
});

const TIMER_STATE_CACHE = 'homework-timer-background-state-v1';
const TIMER_STATE_URL = '/__homework_timer_state__';
const SCHEDULING_BUFFER_MS = 50;
const MS_PER_SECOND = 1000;
const DURATION_TOLERANCE_SECONDS = 1;

let nextEventTimeout = null;

const toMinutesText = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const minuteLabel = mins === 1 ? 'minute' : 'minutes';
  const secondLabel = secs === 1 ? 'second' : 'seconds';
  return secs === 0 ? `${mins} ${minuteLabel}` : `${mins} ${minuteLabel} ${secs} ${secondLabel}`;
};

const getAppUrl = () => self.registration.scope;

const readTimerState = async () => {
  const cache = await caches.open(TIMER_STATE_CACHE);
  const response = await cache.match(TIMER_STATE_URL);
  if (!response) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    await cache.delete(TIMER_STATE_URL);
    return null;
  }
};

const writeTimerState = async (state) => {
  const cache = await caches.open(TIMER_STATE_CACHE);
  await cache.put(
    TIMER_STATE_URL,
    new Response(JSON.stringify(state), {
      headers: {
        'content-type': 'application/json',
      },
    })
  );
};

const clearTimerState = async () => {
  const cache = await caches.open(TIMER_STATE_CACHE);
  await cache.delete(TIMER_STATE_URL);
};

const broadcastToClients = async (message) => {
  const windows = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });
  windows.forEach((windowClient) => windowClient.postMessage(message));
};

const clearNextEventTimeout = () => {
  if (nextEventTimeout === null) {
    return;
  }
  clearTimeout(nextEventTimeout);
  nextEventTimeout = null;
};

const scheduleNextEvent = async () => {
  clearNextEventTimeout();
  const timerState = await readTimerState();
  if (!timerState) {
    return;
  }

  const now = Date.now();
  const nextReminderAt =
    timerState.startTime + (timerState.lastReminderCount + 1) * timerState.intervalSeconds * MS_PER_SECOND;
  const nextEventAt = Math.min(nextReminderAt, timerState.endTime);
  const delay = Math.max(0, nextEventAt - now);

  nextEventTimeout = setTimeout(() => {
    void processTimerEvents();
  }, delay + SCHEDULING_BUFFER_MS);
};

const showCompletionNotification = async () => {
  await self.registration.showNotification('Homework timer complete', {
    body: 'Time is up. Great work finishing your session!',
    data: { url: getAppUrl() },
    tag: 'homework-timer-complete',
    renotify: true,
  });
};

const showReminderNotification = async (elapsedSeconds, remainingSeconds) => {
  await self.registration.showNotification('Homework timer reminder', {
    body: `${toMinutesText(elapsedSeconds)} elapsed, ${toMinutesText(remainingSeconds)} remaining.`,
    data: { url: getAppUrl() },
    tag: 'homework-timer-reminder',
  });
};

const processTimerEvents = async () => {
  const timerState = await readTimerState();
  if (!timerState) {
    return;
  }

  const now = Date.now();
  if (now >= timerState.endTime) {
    await showCompletionNotification();
    await clearTimerState();
    await broadcastToClients({
      type: 'TIMER_COMPLETE',
      statusMessage: 'Session complete.',
    });
    clearNextEventTimeout();
    return;
  }

  const elapsedSeconds = Math.max(0, Math.floor((now - timerState.startTime) / 1000));
  const remainingSeconds = Math.max(0, Math.ceil((timerState.endTime - now) / 1000));
  const intervalCount = Math.floor(elapsedSeconds / timerState.intervalSeconds);

  if (intervalCount > timerState.lastReminderCount) {
    timerState.lastReminderCount = intervalCount;
    await writeTimerState(timerState);
    await showReminderNotification(elapsedSeconds, remainingSeconds);
    await broadcastToClients({
      type: 'TIMER_REMINDER',
    });
    await broadcastToClients({
      type: 'TIMER_STATE_UPDATE',
      lastReminderCount: timerState.lastReminderCount,
      statusMessage: `Reminder: ${toMinutesText(elapsedSeconds)} elapsed, ${toMinutesText(remainingSeconds)} remaining.`,
    });
  }

  await scheduleNextEvent();
};

const normalizeTimerState = (input) => {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const totalSeconds = Number(input.totalSeconds);
  const intervalSeconds = Number(input.intervalSeconds);
  const startTime = Number(input.startTime);
  const endTime = Number(input.endTime);
  const lastReminderCount = Number(input.lastReminderCount);

  if (
    !Number.isFinite(totalSeconds) ||
    !Number.isFinite(intervalSeconds) ||
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime) ||
    totalSeconds <= 0 ||
    intervalSeconds <= 0 ||
    startTime <= 0 ||
    endTime <= startTime
  ) {
    return null;
  }

  const durationSeconds = Math.round((endTime - startTime) / MS_PER_SECOND);
  if (Math.abs(durationSeconds - totalSeconds) > DURATION_TOLERANCE_SECONDS) {
    return null;
  }

  return {
    totalSeconds,
    intervalSeconds,
    startTime,
    endTime,
    lastReminderCount:
      Number.isFinite(lastReminderCount) && Number.isInteger(lastReminderCount) && lastReminderCount >= 0
        ? lastReminderCount
        : 0,
  };
};

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      await processTimerEvents();
    })()
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') {
    return;
  }

  event.waitUntil(
    (async () => {
      if (data.type === 'RESET_TIMER') {
        clearNextEventTimeout();
        await clearTimerState();
        return;
      }

      if (data.type === 'START_TIMER') {
        const nextState = normalizeTimerState(data.timerState);
        if (!nextState) {
          return;
        }
        await writeTimerState(nextState);
        await processTimerEvents();
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const targetUrl = (event.notification.data && event.notification.data.url) || getAppUrl();
      const appUrl = new URL(getAppUrl());
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      const existingAppClient = allClients.find((windowClient) => {
        try {
          const clientUrl = new URL(windowClient.url);
          return clientUrl.origin === appUrl.origin && clientUrl.pathname === appUrl.pathname;
        } catch {
          return false;
        }
      });

      if (existingAppClient) {
        await existingAppClient.focus();
        return;
      }

      await self.clients.openWindow(targetUrl);
    })()
  );
});
