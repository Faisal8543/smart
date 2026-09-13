if (import.meta.env.DEV) {
  const isWsError = (err: any): boolean => {
    if (!err) return false;
    const msg =
      typeof err === 'string'
        ? err
        : err.message || err.reason || err.stack || String(err);

    const lowerMsg = msg.toLowerCase();

    return (
      lowerMsg.includes('websocket closed without opened') ||
      lowerMsg.includes('failed to connect to websocket') ||
      lowerMsg.includes('[vite] failed to connect to websocket') ||
      (lowerMsg.includes('websocket') &&
        (lowerMsg.includes('closed') ||
          lowerMsg.includes('connect') ||
          lowerMsg.includes('failed') ||
          lowerMsg.includes('disconnect')))
    );
  };

  // Handle unhandled promise rejections caused by Vite WebSocket reconnects/disconnects
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    if (isWsError(event.reason)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });

  // Handle global runtime errors caused by Vite WebSocket failures
  window.addEventListener(
    'error',
    (event: ErrorEvent) => {
      if (isWsError(event.error) || isWsError(event.message)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );

  // Suppress console error noise for Vite websocket reconnection failures
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const firstArg = args[0];
    if (isWsError(firstArg)) {
      return;
    }
    originalConsoleError.apply(console, args);
  };
}
