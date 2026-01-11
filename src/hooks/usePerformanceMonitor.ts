import { useCallback, useRef, useEffect } from 'react';

interface PerformanceMetrics {
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  memoryUsage?: number;
}

export const usePerformanceMonitor = (componentName: string) => {
  const metricsRef = useRef<PerformanceMetrics>({
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0
  });
  
  const renderStartTimeRef = useRef<number>(0);

  // Track render start
  useEffect(() => {
    renderStartTimeRef.current = performance.now();
  });

  // Track render end
  useEffect(() => {
    const renderTime = performance.now() - renderStartTimeRef.current;
    const metrics = metricsRef.current;
    
    metrics.renderCount++;
    metrics.lastRenderTime = renderTime;
    metrics.averageRenderTime = (metrics.averageRenderTime * (metrics.renderCount - 1) + renderTime) / metrics.renderCount;
    
    // Log performance warnings
    if (renderTime > 100) {
      console.warn(`⚠️ ${componentName} slow render: ${renderTime.toFixed(2)}ms`);
    }
    
    if (metrics.renderCount > 50) {
      console.warn(`⚠️ ${componentName} excessive re-renders: ${metrics.renderCount}`);
    }
  });

  // Get current metrics
  const getMetrics = useCallback(() => {
    return { ...metricsRef.current };
  }, []);

  // Reset metrics
  const resetMetrics = useCallback(() => {
    metricsRef.current = {
      renderCount: 0,
      lastRenderTime: 0,
      averageRenderTime: 0
    };
  }, []);

  return {
    getMetrics,
    resetMetrics
  };
};


