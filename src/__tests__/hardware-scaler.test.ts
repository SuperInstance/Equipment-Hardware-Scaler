/**
 * Equipment-Hardware-Scaler — Tests
 * Tests ResourceMonitor, AdaptiveScheduler, CloudBridge, HardwareScaler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResourceMonitor } from '../ResourceMonitor';
import { AdaptiveScheduler } from '../AdaptiveScheduler';
import { HardwareScaler } from '../HardwareScaler';

// ═══════════════════════════════════════════════════════════════════
// ResourceMonitor Tests (10 tests)
// ═══════════════════════════════════════════════════════════════════

describe('ResourceMonitor', () => {
  let rm: ResourceMonitor;
  beforeEach(() => { rm = new ResourceMonitor(); });

  it('should create with default config', () => {
    expect(rm).toBeDefined();
  });

  it('should get current metrics', async () => {
    const metrics = await rm.getCurrentMetrics();
    expect(metrics).toBeDefined();
    expect(metrics.cpu).toBeDefined();
    expect(metrics.memory).toBeDefined();
    expect(metrics.gpu).toBeDefined();
    expect(metrics.timestamp).toBeGreaterThan(0);
  });

  it('should have valid cpu metrics', async () => {
    const m = await rm.getCurrentMetrics();
    expect(m.cpu.percentage).toBeGreaterThanOrEqual(0);
    expect(m.cpu.percentage).toBeLessThanOrEqual(100);
  });

  it('should have valid memory metrics', async () => {
    const m = await rm.getCurrentMetrics();
    expect(m.memory.percentage).toBeGreaterThanOrEqual(0);
    expect(m.memory.percentage).toBeLessThanOrEqual(100);
  });

  it('should return null last metrics before collection', () => {
    expect(rm.getLastMetrics()).toBeNull();
  });

  it('should update last metrics after collection', async () => {
    await rm.getCurrentMetrics();
    expect(rm.getLastMetrics()).not.toBeNull();
  });

  it('should register metrics callback', () => {
    const cb = vi.fn();
    const unsub = rm.onMetrics(cb);
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('should check thresholds', async () => {
    const result = await rm.checkThresholds(90, 90, 90);
    expect(result).toBeDefined();
    expect(typeof result.withinLimits).toBe('boolean');
  });

  it('should get available capacity', async () => {
    const cap = await rm.getAvailableCapacity();
    expect(cap).toBeDefined();
  });

  it('should work with custom config', () => {
    const custom = new ResourceMonitor({ interval: 1000 });
    expect(custom).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// AdaptiveScheduler Tests (10 tests)
// ═══════════════════════════════════════════════════════════════════

describe('AdaptiveScheduler', () => {
  let sched: AdaptiveScheduler;
  const schedConfig = {
    cpuThreshold: 80,
    memoryThreshold: 85,
    gpuThreshold: 90,
    costCeiling: 100,
  };
  const m = () => ({
    cpu: { used: 50, total: 100, percentage: 50 },
    memory: { used: 4, total: 8, percentage: 50 },
    gpu: { used: 0, total: 0, percentage: 0, available: false },
    timestamp: Date.now(),
  });
  const ctx = () => ({ totalCostIncurred: 0, costCeiling: 100 });
  beforeEach(() => { sched = new AdaptiveScheduler(schedConfig); });

  it('should create with config', () => {
    expect(sched).toBeDefined();
  });

  it('should schedule a task', () => {
    const task = {
      id: 't-1', type: 'compute', payload: { data: 'test' }, priority: 'normal' as const,
    };
    expect(sched.schedule(task, m(), ctx())).toBeDefined();
  });

  it('should handle high priority task', () => {
    const task = { id: 't-2', type: 'critical', payload: {}, priority: 'critical' as const };
    expect(sched.schedule(task, m(), ctx())).toBeDefined();
  });

  it('should handle low priority task', () => {
    const task = { id: 't-3', type: 'batch', payload: {}, priority: 'low' as const };
    expect(sched.schedule(task, m(), ctx())).toBeDefined();
  });

  it('should handle task with estimated resources', () => {
    const task = {
      id: 't-4', type: 'compute', payload: {},
      estimatedResources: { cpu: 50, memory: 1024, duration: 5000 },
    };
    expect(sched.schedule(task, m(), ctx())).toBeDefined();
  });

  it('should work with no priority specified', () => {
    const task = { id: 't-5', type: 'default', payload: {} };
    expect(sched.schedule(task, m(), ctx())).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// HardwareScaler Tests (10 tests)
// ═══════════════════════════════════════════════════════════════════

describe('HardwareScaler', () => {
  let scaler: HardwareScaler;
  beforeEach(() => { scaler = new HardwareScaler(); });

  it('should create with default config', () => {
    expect(scaler).toBeDefined();
  });

  it('should get stats', () => {
    const stats = scaler.getStats();
    expect(stats).toBeDefined();
    expect(typeof stats.totalTasksProcessed).toBe('number');
  });

  it('should return cloud overflow state', () => {
    const active = scaler.isCloudOverflowActive();
    expect(typeof active).toBe('boolean');
  });

  it('should process a task', async () => {
    const task = {
      id: 'ht-1',
      type: 'compute',
      payload: { data: 'test' },
    };
    const result = await scaler.processTask(task);
    expect(result).toBeDefined();
  });

  it('should handle multiple tasks', async () => {
    for (let i = 0; i < 3; i++) {
      await scaler.processTask({ id: `ht-${i}`, type: 'test', payload: {} });
    }
    const stats = scaler.getStats();
    expect(stats.totalTasksProcessed).toBeGreaterThanOrEqual(3);
  });

  it('should register scale event listener', () => {
    const listener = vi.fn();
    const unsub = scaler.onScaleEvent(listener);
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('should get resource metrics', async () => {
    const metrics = await scaler.getResourceMetrics();
    expect(metrics).toBeDefined();
  });

  it('should return cost summary', () => {
    const cost = scaler.getCostSummary();
    expect(cost).toBeDefined();
  });

  it('should work with custom config', () => {
    const custom = new HardwareScaler({
      cpuThreshold: 75,
      memoryThreshold: 80,
      costCeiling: 50,
    });
    expect(custom).toBeDefined();
  });

  it('should force cloud processing', async () => {
    const result = await scaler.forceCloud({
      id: 'fc-1',
      type: 'test',
      payload: {},
    });
    expect(result).toBeDefined();
  });
});
