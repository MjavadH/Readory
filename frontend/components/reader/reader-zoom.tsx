'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch';

export const READER_MIN_ZOOM = 1;
export const READER_MAX_ZOOM = 5;
export const READER_ZOOM_STEP = 0.25;

/** Wheel zoom intensity. 0.001–0.003 feels natural on both mouse and trackpad. */
const WHEEL_INTENSITY = 0.0015;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export type ReaderZoomApi = {
  ref: React.MutableRefObject<ReactZoomPanPinchRef | null>;
  scale: number;
  isZoomed: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  /** internal: used by <ReaderZoomViewport /> */
  setScale: (scale: number) => void;
};

export function useReaderZoom(): ReaderZoomApi {
  const ref = useRef<ReactZoomPanPinchRef | null>(null);
  const [scale, setScale] = useState(1);

  const zoomIn = useCallback(() => {
    ref.current?.zoomIn(READER_ZOOM_STEP, 180);
  }, []);

  const zoomOut = useCallback(() => {
    ref.current?.zoomOut(READER_ZOOM_STEP, 180);
  }, []);

  const resetZoom = useCallback(() => {
    ref.current?.resetTransform(180);
  }, []);

  return {
    ref,
    scale,
    setScale,
    isZoomed: scale > 1.001,
    canZoomIn: scale < READER_MAX_ZOOM - 0.001,
    canZoomOut: scale > READER_MIN_ZOOM + 0.001,
    zoomIn,
    zoomOut,
    resetZoom,
  };
}

interface ReaderZoomViewportProps {
  zoom: ReaderZoomApi;
  children: ReactNode;
  className?: string;
}

export function ReaderZoomViewport({ zoom, children, className = '' }: ReaderZoomViewportProps) {
  const { setScale, isZoomed, resetZoom } = zoom;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onFullscreenChange = () => resetZoom();
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [resetZoom]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // Alt on Windows/Linux, Option on macOS; ctrlKey === trackpad pinch.
      if (!e.altKey && !e.ctrlKey) return; // plain wheel => normal scrolling
      e.preventDefault();
      e.stopPropagation();

      const instance = zoom.ref.current;
      if (!instance) return;

      const { scale, positionX, positionY } = instance.state;

      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const next = clamp(scale * Math.exp(-dy * WHEEL_INTENSITY), READER_MIN_ZOOM, READER_MAX_ZOOM);
      if (Math.abs(next - scale) < 0.0001) return;

      // Keep the point under the cursor fixed.
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const k = next / scale;

      instance.setTransform(px - (px - positionX) * k, py - (py - positionY) * k, next, 0);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoom.ref]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full max-w-full overflow-hidden ${className}`}
      style={{ touchAction: isZoomed ? 'none' : 'pan-y' }}
    >
      <TransformWrapper
        ref={zoom.ref}
        initialScale={1}
        minScale={READER_MIN_ZOOM}
        maxScale={READER_MAX_ZOOM}
        centerOnInit={false}
        limitToBounds={false}
        smooth
        doubleClick={{ disabled: true }}
        wheel={{ disabled: true }}
        pinch={{ step: 5 }}
        panning={{ disabled: !isZoomed, velocityDisabled: true }}
        onTransform={(_ref, state) => setScale(state.scale)}
      >
        <TransformComponent
          wrapperClass="!w-full !max-w-full !overflow-hidden"
          wrapperStyle={{ width: '100%', overflow: 'hidden' }}
          contentClass="!w-full !max-w-full !block"
          contentStyle={{ width: '100%' }}
        >
          {children}
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}
