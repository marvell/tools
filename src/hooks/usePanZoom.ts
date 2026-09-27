import { useState, useRef, useEffect, useCallback, type RefObject } from "react";

const DEFAULT_MIN_ZOOM = 0.1;
const DEFAULT_MAX_ZOOM = 5;
const FRAME_DURATION = 1000 / 60;
const FRICTION_PER_FRAME = 0.92;
const MIN_VELOCITY = 0.03;
const VELOCITY_STALE_AFTER = 80;

type Point = { x: number; y: number };
type ViewState = { zoom: number; pan: Point };

export interface PanZoomConfig {
  minZoom?: number;
  maxZoom?: number;
  initialZoom?: number;
  initialPan?: Point;
}

export interface PanZoomState {
  zoom: number;
  isDragging: boolean;
}

export interface PanZoomControls {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: Point) => void;
  fitToView: (
    contentWidth: number,
    contentHeight: number,
    containerWidth: number,
    containerHeight: number,
    padding?: number,
  ) => void;
}

export interface PanZoomHandlers {
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
  onTouchStart: (event: React.TouchEvent<HTMLDivElement>) => void;
  onTouchMove: (event: React.TouchEvent<HTMLDivElement>) => void;
  onTouchEnd: (event: React.TouchEvent<HTMLDivElement>) => void;
}

export interface UsePanZoomResult {
  state: PanZoomState;
  controls: PanZoomControls;
  handlers: PanZoomHandlers;
  containerRef: RefObject<HTMLDivElement | null>;
  setContainerRef: (node: HTMLDivElement | null) => void;
  setTransformRef: (node: HTMLDivElement | null) => void;
}

const applyTransform = (element: HTMLDivElement, view: ViewState) => {
  const pixelRatio = window.devicePixelRatio || 1;
  const x = Math.round(view.pan.x * pixelRatio) / pixelRatio;
  const y = Math.round(view.pan.y * pixelRatio) / pixelRatio;
  element.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${view.zoom})`;
};

const normalizeWheelDelta = (value: number, mode: number, pageSize: number) => {
  if (mode === WheelEvent.DOM_DELTA_LINE) return value * 16;
  if (mode === WheelEvent.DOM_DELTA_PAGE) return value * pageSize;
  return value;
};

export function usePanZoom(config: PanZoomConfig = {}): UsePanZoomResult {
  const minZoom = config.minZoom ?? DEFAULT_MIN_ZOOM;
  const maxZoom = config.maxZoom ?? DEFAULT_MAX_ZOOM;
  const initialZoom = Math.min(Math.max(config.initialZoom ?? 1, minZoom), maxZoom);
  const initialPanX = config.initialPan?.x ?? 0;
  const initialPanY = config.initialPan?.y ?? 0;

  const [zoom, setRenderedZoom] = useState(initialZoom);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<HTMLDivElement>(null);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const viewRef = useRef<ViewState>({
    zoom: initialZoom,
    pan: { x: initialPanX, y: initialPanY },
  });
  const renderedZoomRef = useRef(initialZoom);
  const viewFrameRef = useRef<number | null>(null);
  const momentumRef = useRef<number | null>(null);

  const dragRef = useRef({
    active: false,
    pointerId: null as number | null,
    startX: 0,
    startY: 0,
    panStartX: 0,
    panStartY: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    velocityX: 0,
    velocityY: 0,
  });

  const touchRef = useRef<{
    startDist: number;
    startZoom: number;
    centerX: number;
    centerY: number;
    startCenterClientX: number;
    startCenterClientY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  const clampZoom = useCallback(
    (value: number) => Math.min(Math.max(value, minZoom), maxZoom),
    [minZoom, maxZoom],
  );

  const renderCurrentView = useCallback(() => {
    if (transformRef.current) {
      applyTransform(transformRef.current, viewRef.current);
    }

    if (renderedZoomRef.current !== viewRef.current.zoom) {
      renderedZoomRef.current = viewRef.current.zoom;
      setRenderedZoom(viewRef.current.zoom);
    }
  }, []);

  const scheduleViewRender = useCallback(() => {
    if (viewFrameRef.current !== null) return;

    viewFrameRef.current = requestAnimationFrame(() => {
      viewFrameRef.current = null;
      renderCurrentView();
    });
  }, [renderCurrentView]);

  const renderViewImmediately = useCallback(() => {
    if (viewFrameRef.current !== null) {
      cancelAnimationFrame(viewFrameRef.current);
      viewFrameRef.current = null;
    }
    renderCurrentView();
  }, [renderCurrentView]);

  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    setContainerEl(node);
  }, []);

  const setTransformRef = useCallback((node: HTMLDivElement | null) => {
    transformRef.current = node;
    if (node) applyTransform(node, viewRef.current);
  }, []);

  const stopMomentum = useCallback(() => {
    if (momentumRef.current !== null) {
      cancelAnimationFrame(momentumRef.current);
      momentumRef.current = null;
    }
  }, []);

  const startMomentum = useCallback(() => {
    stopMomentum();
    let lastFrameTime = performance.now();

    const animate = (time: number) => {
      const drag = dragRef.current;
      const elapsed = Math.max(time - lastFrameTime, 0);
      lastFrameTime = time;

      // Avoid a large jump when an animation resumes after the page was suspended.
      if (elapsed > 100) {
        momentumRef.current = null;
        return;
      }

      const decay = Math.pow(FRICTION_PER_FRAME, elapsed / FRAME_DURATION);
      drag.velocityX *= decay;
      drag.velocityY *= decay;

      if (Math.abs(drag.velocityX) < MIN_VELOCITY && Math.abs(drag.velocityY) < MIN_VELOCITY) {
        momentumRef.current = null;
        return;
      }

      const current = viewRef.current;
      viewRef.current = {
        zoom: current.zoom,
        pan: {
          x: current.pan.x + drag.velocityX * elapsed,
          y: current.pan.y + drag.velocityY * elapsed,
        },
      };
      renderCurrentView();
      momentumRef.current = requestAnimationFrame(animate);
    };

    momentumRef.current = requestAnimationFrame(animate);
  }, [renderCurrentView, stopMomentum]);

  const beginDrag = useCallback((
    clientX: number,
    clientY: number,
    pointerId: number | null = null,
    eventTime = performance.now(),
  ) => {
    const currentPan = viewRef.current.pan;

    dragRef.current = {
      active: true,
      pointerId,
      startX: clientX,
      startY: clientY,
      panStartX: currentPan.x,
      panStartY: currentPan.y,
      lastX: clientX,
      lastY: clientY,
      lastTime: eventTime,
      velocityX: 0,
      velocityY: 0,
    };
    setIsDragging(true);
  }, []);

  const updateDrag = useCallback(
    (clientX: number, clientY: number, eventTime = performance.now()) => {
      const drag = dragRef.current;
      if (!drag.active) return;

      const elapsed = Math.max(eventTime - drag.lastTime, 1);
      if (elapsed > 0) {
        drag.velocityX = (clientX - drag.lastX) / elapsed;
        drag.velocityY = (clientY - drag.lastY) / elapsed;
      }
      drag.lastX = clientX;
      drag.lastY = clientY;
      drag.lastTime = eventTime;

      viewRef.current = {
        zoom: viewRef.current.zoom,
        pan: {
          x: drag.panStartX + clientX - drag.startX,
          y: drag.panStartY + clientY - drag.startY,
        },
      };
      scheduleViewRender();
    },
    [scheduleViewRender],
  );

  const finishDrag = useCallback(
    (withMomentum: boolean) => {
      const drag = dragRef.current;
      if (!drag.active) return;

      drag.active = false;
      drag.pointerId = null;
      setIsDragging(false);
      renderViewImmediately();

      if (performance.now() - drag.lastTime > VELOCITY_STALE_AFTER) {
        drag.velocityX = 0;
        drag.velocityY = 0;
      }

      if (
        withMomentum &&
        (Math.abs(drag.velocityX) >= MIN_VELOCITY || Math.abs(drag.velocityY) >= MIN_VELOCITY)
      ) {
        startMomentum();
      }
    },
    [renderViewImmediately, startMomentum],
  );

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      stopMomentum();

      const container = containerRef.current;
      if (!container) return;

      const deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode, container.clientWidth);
      const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode, container.clientHeight);
      const current = viewRef.current;

      if (event.ctrlKey || event.metaKey) {
        const rect = container.getBoundingClientRect();
        const cursorX = event.clientX - rect.left - rect.width / 2;
        const cursorY = event.clientY - rect.top - rect.height / 2;
        const limitedDelta = Math.min(Math.max(deltaY, -100), 100);
        const nextZoom = clampZoom(current.zoom * Math.exp(-limitedDelta * 0.01));
        const zoomRatio = nextZoom / current.zoom;

        viewRef.current = {
          zoom: nextZoom,
          pan: {
            x: cursorX - (cursorX - current.pan.x) * zoomRatio,
            y: cursorY - (cursorY - current.pan.y) * zoomRatio,
          },
        };
      } else {
        viewRef.current = {
          zoom: current.zoom,
          pan: {
            x: current.pan.x - deltaX,
            y: current.pan.y - deltaY,
          },
        };
      }

      scheduleViewRender();
    },
    [clampZoom, scheduleViewRender, stopMomentum],
  );

  useEffect(() => {
    if (!containerEl) return;

    containerEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => containerEl.removeEventListener("wheel", handleWheel);
  }, [containerEl, handleWheel]);

  useEffect(
    () => () => {
      stopMomentum();
      if (viewFrameRef.current !== null) cancelAnimationFrame(viewFrameRef.current);
    },
    [stopMomentum],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "touch" || event.button !== 0) return;
      if (
        event.target instanceof Element &&
        event.target.closest("a, button, input, textarea, select, [role='button'], [contenteditable='true']")
      ) {
        return;
      }

      event.preventDefault();
      stopMomentum();
      event.currentTarget.setPointerCapture(event.pointerId);
      beginDrag(event.clientX, event.clientY, event.pointerId, event.timeStamp);
    },
    [beginDrag, stopMomentum],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;
      if ((event.buttons & 1) === 0) {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        finishDrag(true);
        return;
      }

      const samples = event.nativeEvent.getCoalescedEvents?.();
      const latest = samples?.[samples.length - 1] ?? event.nativeEvent;
      updateDrag(latest.clientX, latest.clientY, latest.timeStamp);
    },
    [finishDrag, updateDrag],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (dragRef.current.pointerId !== event.pointerId) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      finishDrag(true);
    },
    [finishDrag],
  );

  const handlePointerCancel = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (dragRef.current.pointerId !== event.pointerId) return;
      finishDrag(false);
    },
    [finishDrag],
  );

  const handleTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      stopMomentum();

      if (event.touches.length === 2) {
        const container = containerRef.current;
        if (!container) return;

        const touch0 = event.touches[0]!;
        const touch1 = event.touches[1]!;
        const centerClientX = (touch0.clientX + touch1.clientX) / 2;
        const centerClientY = (touch0.clientY + touch1.clientY) / 2;
        const rect = container.getBoundingClientRect();
        const current = viewRef.current;

        touchRef.current = {
          startDist: Math.hypot(touch0.clientX - touch1.clientX, touch0.clientY - touch1.clientY),
          startZoom: current.zoom,
          centerX: centerClientX - rect.left - rect.width / 2,
          centerY: centerClientY - rect.top - rect.height / 2,
          startCenterClientX: centerClientX,
          startCenterClientY: centerClientY,
          startPanX: current.pan.x,
          startPanY: current.pan.y,
        };
        dragRef.current.active = false;
        setIsDragging(false);
      } else if (event.touches.length === 1) {
        const touch = event.touches[0]!;
        beginDrag(touch.clientX, touch.clientY, null, event.timeStamp);
      }
    },
    [beginDrag, stopMomentum],
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (event.touches.length === 2 && touchRef.current) {
        const touch0 = event.touches[0]!;
        const touch1 = event.touches[1]!;
        const currentCenterX = (touch0.clientX + touch1.clientX) / 2;
        const currentCenterY = (touch0.clientY + touch1.clientY) / 2;
        const distance = Math.hypot(touch0.clientX - touch1.clientX, touch0.clientY - touch1.clientY);
        const touch = touchRef.current;
        const nextZoom = clampZoom(touch.startZoom * (distance / touch.startDist));
        const zoomRatio = nextZoom / touch.startZoom;

        viewRef.current = {
          zoom: nextZoom,
          pan: {
            x:
              touch.centerX -
              (touch.centerX - touch.startPanX) * zoomRatio +
              currentCenterX -
              touch.startCenterClientX,
            y:
              touch.centerY -
              (touch.centerY - touch.startPanY) * zoomRatio +
              currentCenterY -
              touch.startCenterClientY,
          },
        };
        scheduleViewRender();
      } else if (event.touches.length === 1) {
        const touch = event.touches[0]!;
        updateDrag(touch.clientX, touch.clientY, event.timeStamp);
      }
    },
    [clampZoom, scheduleViewRender, updateDrag],
  );

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (event.touches.length === 1) {
        const touch = event.touches[0]!;
        touchRef.current = null;
        beginDrag(touch.clientX, touch.clientY, null, event.timeStamp);
        return;
      }

      touchRef.current = null;
      finishDrag(true);
    },
    [beginDrag, finishDrag],
  );

  const setZoom = useCallback(
    (value: number) => {
      stopMomentum();
      viewRef.current = { ...viewRef.current, zoom: clampZoom(value) };
      renderViewImmediately();
    },
    [clampZoom, renderViewImmediately, stopMomentum],
  );

  const setPan = useCallback(
    (pan: Point) => {
      stopMomentum();
      viewRef.current = { ...viewRef.current, pan };
      renderViewImmediately();
    },
    [renderViewImmediately, stopMomentum],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      stopMomentum();
      const current = viewRef.current;
      const nextZoom = clampZoom(current.zoom * factor);
      if (nextZoom === current.zoom) return;

      const zoomRatio = nextZoom / current.zoom;
      viewRef.current = {
        zoom: nextZoom,
        pan: {
          x: current.pan.x * zoomRatio,
          y: current.pan.y * zoomRatio,
        },
      };
      renderViewImmediately();
    },
    [clampZoom, renderViewImmediately, stopMomentum],
  );

  const zoomIn = useCallback(() => zoomBy(1.2), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(1 / 1.2), [zoomBy]);

  const reset = useCallback(() => {
    stopMomentum();
    viewRef.current = {
      zoom: initialZoom,
      pan: { x: initialPanX, y: initialPanY },
    };
    renderViewImmediately();
  }, [initialPanX, initialPanY, initialZoom, renderViewImmediately, stopMomentum]);

  const fitToView = useCallback(
    (
      contentWidth: number,
      contentHeight: number,
      containerWidth: number,
      containerHeight: number,
      padding = 80,
    ) => {
      if (contentWidth <= 0 || contentHeight <= 0 || containerWidth <= 0 || containerHeight <= 0) return;

      stopMomentum();
      const scaleX = Math.max(containerWidth - padding, 1) / contentWidth;
      const scaleY = Math.max(containerHeight - padding, 1) / contentHeight;
      viewRef.current = {
        zoom: clampZoom(Math.min(scaleX, scaleY, 2)),
        pan: { x: 0, y: 0 },
      };
      renderViewImmediately();
    },
    [clampZoom, renderViewImmediately, stopMomentum],
  );

  return {
    state: { zoom, isDragging },
    controls: { zoomIn, zoomOut, reset, setZoom, setPan, fitToView },
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    containerRef,
    setContainerRef,
    setTransformRef,
  };
}
