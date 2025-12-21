import { useState, useRef, useEffect, useCallback, type RefObject } from "react";

// Zoom constraints
const DEFAULT_MIN_ZOOM = 0.1;
const DEFAULT_MAX_ZOOM = 5;

// Momentum physics constants
const FRICTION = 0.92;
const MIN_VELOCITY = 0.5;

export interface PanZoomConfig {
  minZoom?: number;
  maxZoom?: number;
  initialZoom?: number;
  initialPan?: { x: number; y: number };
}

export interface PanZoomState {
  zoom: number;
  pan: { x: number; y: number };
  isDragging: boolean;
}

export interface PanZoomControls {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  fitToView: (contentWidth: number, contentHeight: number, containerWidth: number, containerHeight: number, padding?: number) => void;
}

export interface PanZoomHandlers {
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

export interface UsePanZoomResult {
  state: PanZoomState;
  controls: PanZoomControls;
  handlers: PanZoomHandlers;
  containerRef: RefObject<HTMLDivElement | null>;
}

export function usePanZoom(config: PanZoomConfig = {}): UsePanZoomResult {
  const {
    minZoom = DEFAULT_MIN_ZOOM,
    maxZoom = DEFAULT_MAX_ZOOM,
    initialZoom = 1,
    initialPan = { x: 0, y: 0 },
  } = config;

  const [zoom, setZoom] = useState(initialZoom);
  const [pan, setPan] = useState(initialPan);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Refs for gesture tracking (avoid stale closures)
  const stateRef = useRef({ zoom: initialZoom, pan: initialPan });
  const dragRef = useRef({
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
    startPanX: number;
    startPanY: number;
  } | null>(null);
  const momentumRef = useRef<number | null>(null);

  // Keep stateRef in sync
  useEffect(() => {
    stateRef.current = { zoom, pan };
  }, [zoom, pan]);

  // Clamp zoom to bounds
  const clampZoom = useCallback(
    (z: number) => Math.min(Math.max(z, minZoom), maxZoom),
    [minZoom, maxZoom]
  );

  // Stop any ongoing momentum animation
  const stopMomentum = useCallback(() => {
    if (momentumRef.current) {
      cancelAnimationFrame(momentumRef.current);
      momentumRef.current = null;
    }
  }, []);

  // Start momentum animation after drag release
  const startMomentum = useCallback(() => {
    const animate = () => {
      const drag = dragRef.current;

      // Apply friction
      drag.velocityX *= FRICTION;
      drag.velocityY *= FRICTION;

      // Stop when velocity is negligible
      if (Math.abs(drag.velocityX) < MIN_VELOCITY && Math.abs(drag.velocityY) < MIN_VELOCITY) {
        momentumRef.current = null;
        return;
      }

      // Update pan
      setPan((p) => ({
        x: p.x + drag.velocityX,
        y: p.y + drag.velocityY,
      }));

      momentumRef.current = requestAnimationFrame(animate);
    };

    momentumRef.current = requestAnimationFrame(animate);
  }, []);

  // Handle mouse wheel zoom - zoom towards cursor position
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left - rect.width / 2;
      const cursorY = e.clientY - rect.top - rect.height / 2;

      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const oldZoom = stateRef.current.zoom;
      const newZoom = clampZoom(oldZoom * delta);

      // Adjust pan to keep cursor point stationary
      const zoomRatio = newZoom / oldZoom;
      const oldPan = stateRef.current.pan;
      const newPanX = cursorX - (cursorX - oldPan.x) * zoomRatio;
      const newPanY = cursorY - (cursorY - oldPan.y) * zoomRatio;

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    },
    [clampZoom]
  );

  // Setup wheel event listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // Cleanup momentum on unmount
  useEffect(() => {
    return () => stopMomentum();
  }, [stopMomentum]);

  // Mouse drag handlers with momentum
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      stopMomentum();
      setIsDragging(true);

      const now = Date.now();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        panStartX: stateRef.current.pan.x,
        panStartY: stateRef.current.pan.y,
        lastX: e.clientX,
        lastY: e.clientY,
        lastTime: now,
        velocityX: 0,
        velocityY: 0,
      };
    },
    [stopMomentum]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.lastTime) return;

    const now = Date.now();
    const drag = dragRef.current;
    const dt = Math.max(now - drag.lastTime, 1);

    // Calculate velocity for momentum
    drag.velocityX = ((e.clientX - drag.lastX) / dt) * 16; // normalize to ~60fps
    drag.velocityY = ((e.clientY - drag.lastY) / dt) * 16;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    drag.lastTime = now;

    // Update pan position
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setPan({ x: drag.panStartX + dx, y: drag.panStartY + dy });
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    // Start momentum if there's velocity
    const drag = dragRef.current;
    if (Math.abs(drag.velocityX) > MIN_VELOCITY || Math.abs(drag.velocityY) > MIN_VELOCITY) {
      startMomentum();
    }

    // Reset lastTime to prevent handleMouseMove from processing further movements
    drag.lastTime = 0;
  }, [isDragging, startMomentum]);

  // Touch handlers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      stopMomentum();

      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();

      if (e.touches.length === 2) {
        // Pinch zoom start - store center point for zoom-to-point
        const touch0 = e.touches[0]!;
        const touch1 = e.touches[1]!;
        const centerX = (touch0.clientX + touch1.clientX) / 2;
        const centerY = (touch0.clientY + touch1.clientY) / 2;
        const dist = Math.hypot(touch0.clientX - touch1.clientX, touch0.clientY - touch1.clientY);

        touchRef.current = {
          startDist: dist,
          startZoom: stateRef.current.zoom,
          centerX: centerX - rect.left - rect.width / 2,
          centerY: centerY - rect.top - rect.height / 2,
          startPanX: stateRef.current.pan.x,
          startPanY: stateRef.current.pan.y,
        };
        setIsDragging(false);
      } else if (e.touches.length === 1) {
        // Single finger pan
        const touch = e.touches[0]!;
        setIsDragging(true);
        const now = Date.now();
        dragRef.current = {
          startX: touch.clientX,
          startY: touch.clientY,
          panStartX: stateRef.current.pan.x,
          panStartY: stateRef.current.pan.y,
          lastX: touch.clientX,
          lastY: touch.clientY,
          lastTime: now,
          velocityX: 0,
          velocityY: 0,
        };
      }
    },
    [stopMomentum]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();

      if (e.touches.length === 2 && touchRef.current) {
        // Pinch zoom - zoom towards pinch center
        const touch0 = e.touches[0]!;
        const touch1 = e.touches[1]!;
        const currentCenterX = (touch0.clientX + touch1.clientX) / 2;
        const currentCenterY = (touch0.clientY + touch1.clientY) / 2;
        const dist = Math.hypot(touch0.clientX - touch1.clientX, touch0.clientY - touch1.clientY);

        const scale = dist / touchRef.current.startDist;
        const newZoom = clampZoom(touchRef.current.startZoom * scale);

        // Calculate pan adjustment to zoom towards pinch center
        const touch = touchRef.current;
        const zoomRatio = newZoom / touch.startZoom;

        // Also allow panning while pinching (two-finger drag)
        const panDeltaX = currentCenterX - rect.left - rect.width / 2 - touch.centerX;
        const panDeltaY = currentCenterY - rect.top - rect.height / 2 - touch.centerY;

        const newPanX = touch.centerX - (touch.centerX - touch.startPanX) * zoomRatio + panDeltaX;
        const newPanY = touch.centerY - (touch.centerY - touch.startPanY) * zoomRatio + panDeltaY;

        setZoom(newZoom);
        setPan({ x: newPanX, y: newPanY });
      } else if (e.touches.length === 1 && isDragging) {
        // Single finger pan with velocity tracking
        const touch = e.touches[0]!;
        const now = Date.now();
        const drag = dragRef.current;
        const dt = Math.max(now - drag.lastTime, 1);

        drag.velocityX = ((touch.clientX - drag.lastX) / dt) * 16;
        drag.velocityY = ((touch.clientY - drag.lastY) / dt) * 16;
        drag.lastX = touch.clientX;
        drag.lastY = touch.clientY;
        drag.lastTime = now;

        const dx = touch.clientX - drag.startX;
        const dy = touch.clientY - drag.startY;
        setPan({ x: drag.panStartX + dx, y: drag.panStartY + dy });
      }
    },
    [clampZoom, isDragging]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      // If still have touches, might be transitioning from pinch to pan
      if (e.touches.length === 1) {
        // Transition from pinch to pan
        const touch = e.touches[0]!;
        setIsDragging(true);
        touchRef.current = null;
        const now = Date.now();
        dragRef.current = {
          startX: touch.clientX,
          startY: touch.clientY,
          panStartX: stateRef.current.pan.x,
          panStartY: stateRef.current.pan.y,
          lastX: touch.clientX,
          lastY: touch.clientY,
          lastTime: now,
          velocityX: 0,
          velocityY: 0,
        };
        return;
      }

      // All fingers lifted
      touchRef.current = null;

      if (isDragging) {
        setIsDragging(false);
        // Start momentum for touch pan
        const drag = dragRef.current;
        if (Math.abs(drag.velocityX) > MIN_VELOCITY || Math.abs(drag.velocityY) > MIN_VELOCITY) {
          startMomentum();
        }
      }
    },
    [isDragging, startMomentum]
  );

  // Control functions
  const zoomIn = useCallback(() => {
    setZoom((z) => clampZoom(z * 1.2));
  }, [clampZoom]);

  const zoomOut = useCallback(() => {
    setZoom((z) => clampZoom(z / 1.2));
  }, [clampZoom]);

  const reset = useCallback(() => {
    setZoom(initialZoom);
    setPan(initialPan);
  }, [initialZoom, initialPan]);

  const fitToView = useCallback(
    (contentWidth: number, contentHeight: number, containerWidth: number, containerHeight: number, padding = 80) => {
      const scaleX = (containerWidth - padding) / contentWidth;
      const scaleY = (containerHeight - padding) / contentHeight;
      const newZoom = clampZoom(Math.min(scaleX, scaleY, 2));

      setZoom(newZoom);
      setPan({ x: 0, y: 0 });
    },
    [clampZoom]
  );

  return {
    state: { zoom, pan, isDragging },
    controls: { zoomIn, zoomOut, reset, setZoom, setPan, fitToView },
    handlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    containerRef,
  };
}
