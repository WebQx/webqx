/**
 * Tests for Priority Queue Implementation
 */

import { PriorityQueue, HealthcarePriorities, QueueItem } from '../priorityQueue';

describe('PriorityQueue', () => {
  let queue: PriorityQueue;

  beforeEach(() => {
    queue = new PriorityQueue({
      enableMetrics: true,
      enableLogging: false,
      maxQueueSize: 10
    });
  });

  describe('Basic Queue Operations', () => {
    test('should enqueue and dequeue items in priority order', () => {
      // Add items with different priorities
      queue.enqueue('low priority task', 1);
      queue.enqueue('critical task', 10);
      queue.enqueue('medium priority task', 5);

      // Should dequeue in priority order (highest first)
      const first = queue.dequeue();
      expect(first?.data).toBe('critical task');
      expect(first?.priority).toBe(10);

      const second = queue.dequeue();
      expect(second?.data).toBe('medium priority task');
      expect(second?.priority).toBe(5);

      const third = queue.dequeue();
      expect(third?.data).toBe('low priority task');
      expect(third?.priority).toBe(1);
    });

    test('should handle items with same priority (FIFO)', () => {
      queue.enqueue('first', 5);
      queue.enqueue('second', 5);
      queue.enqueue('third', 5);

      const first = queue.dequeue();
      const second = queue.dequeue();
      const third = queue.dequeue();

      expect(first?.data).toBe('first');
      expect(second?.data).toBe('second');
      expect(third?.data).toBe('third');
    });

    test('should return null when dequeuing from empty queue', () => {
      const item = queue.dequeue();
      expect(item).toBeNull();
    });

    test('should peek at next item without removing it', () => {
      queue.enqueue('test item', 5);
      
      const peeked = queue.peek();
      expect(peeked?.data).toBe('test item');
      expect(queue.size()).toBe(1);

      const dequeued = queue.dequeue();
      expect(dequeued?.data).toBe('test item');
      expect(queue.size()).toBe(0);
    });
  });

  describe('Queue Management', () => {
    test('should track queue size correctly', () => {
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);

      queue.enqueue('item1', 1);
      expect(queue.size()).toBe(1);
      expect(queue.isEmpty()).toBe(false);

      queue.enqueue('item2', 2);
      expect(queue.size()).toBe(2);

      queue.dequeue();
      expect(queue.size()).toBe(1);

      queue.dequeue();
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });

    test('should enforce maximum queue size', () => {
      // Fill queue to maximum
      for (let i = 0; i < 10; i++) {
        queue.enqueue(`item${i}`, i);
      }

      // Should throw error when trying to add beyond capacity
      expect(() => {
        queue.enqueue('overflow item', 1);
      }).toThrow('Queue is full');
    });

    test('should clear queue completely', () => {
      queue.enqueue('item1', 1);
      queue.enqueue('item2', 2);
      
      expect(queue.size()).toBe(2);
      
      queue.clear();
      
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });

    test('should remove specific items by ID', () => {
      const id1 = queue.enqueue('item1', 1);
      const id2 = queue.enqueue('item2', 2);
      
      expect(queue.size()).toBe(2);
      
      const removed = queue.removeItem(id1);
      expect(removed).toBe(true);
      expect(queue.size()).toBe(1);
      
      const notFound = queue.removeItem('nonexistent');
      expect(notFound).toBe(false);
    });
  });

  describe('Priority Handling', () => {
    test('should get items by priority level', () => {
      queue.enqueue('high1', 10);
      queue.enqueue('medium1', 5);
      queue.enqueue('high2', 10);
      queue.enqueue('low1', 1);

      const highPriorityItems = queue.getItemsByPriority(10);
      expect(highPriorityItems).toHaveLength(2);
      expect(highPriorityItems[0].data).toBe('high1');
      expect(highPriorityItems[1].data).toBe('high2');

      const mediumPriorityItems = queue.getItemsByPriority(5);
      expect(mediumPriorityItems).toHaveLength(1);
      expect(mediumPriorityItems[0].data).toBe('medium1');
    });

    test('should handle complex priority scenarios', () => {
      // Healthcare scenario: critical patient data processing
      queue.enqueue('routine lab result', HealthcarePriorities.LOW);
      queue.enqueue('emergency surgery prep', HealthcarePriorities.CRITICAL);
      queue.enqueue('urgent consultation request', HealthcarePriorities.URGENT);
      queue.enqueue('standard appointment', HealthcarePriorities.MEDIUM);

      const first = queue.dequeue();
      expect(first?.data).toBe('emergency surgery prep');
      expect(first?.priority).toBe(HealthcarePriorities.CRITICAL);

      const second = queue.dequeue();
      expect(second?.data).toBe('urgent consultation request');
      expect(second?.priority).toBe(HealthcarePriorities.URGENT);
    });
  });

  describe('Processing Lifecycle', () => {
    test('should track processing and completion states', () => {
      const itemId = queue.enqueue('test item', 5);
      
      // Item should be in queue
      expect(queue.size()).toBe(1);
      
      // Dequeue for processing
      const item = queue.dequeue();
      expect(item?.id).toBe(itemId);
      expect(queue.size()).toBe(0);
      
      // Mark as completed
      queue.markCompleted(itemId);
      
      const metrics = queue.getMetrics();
      expect(metrics.processingItems).toBe(0);
    });

    test('should handle failed items with requeue option', () => {
      const itemId = queue.enqueue('failing item', 5);
      
      const item = queue.dequeue();
      expect(item?.id).toBe(itemId);
      
      // Mark as failed and requeue with lower priority
      queue.markFailed(itemId, true, 3, item!);
      
      expect(queue.size()).toBe(1);
      const requeued = queue.peek();
      expect(requeued?.priority).toBe(3);
      expect(requeued?.metadata?.retryCount).toBe(1);
    });
  });

  describe('Metrics and Monitoring', () => {
    test('should calculate queue metrics correctly', () => {
      queue.enqueue('item1', 10);
      queue.enqueue('item2', 5);
      queue.enqueue('item3', 10);
      
      const metrics = queue.getMetrics();
      
      expect(metrics.totalItems).toBe(3);
      expect(metrics.queueLengthByPriority[10]).toBe(2);
      expect(metrics.queueLengthByPriority[5]).toBe(1);
      expect(metrics.lastProcessedTime).toBeDefined();
    });

    test('should track processing items separately', () => {
      const id1 = queue.enqueue('item1', 5);
      const id2 = queue.enqueue('item2', 3);
      
      // Process one item
      queue.dequeue();
      
      const metrics = queue.getMetrics();
      expect(metrics.processingItems).toBe(1);
      expect(queue.size()).toBe(1);
    });
  });

  describe('Metadata Support', () => {
    test('should store and retrieve item metadata', () => {
      const metadata = {
        patientId: 'patient-123',
        urgencyReason: 'chest pain',
        departmentId: 'emergency'
      };
      
      const itemId = queue.enqueue('emergency case', 10, metadata);
      
      const item = queue.dequeue();
      expect(item?.metadata).toEqual(metadata);
    });
  });
});

describe('HealthcarePriorities', () => {
  test('should convert string priorities to numeric values', () => {
    expect(HealthcarePriorities.fromString('critical')).toBe(100);
    expect(HealthcarePriorities.fromString('urgent')).toBe(75);
    expect(HealthcarePriorities.fromString('high')).toBe(50);
    expect(HealthcarePriorities.fromString('medium')).toBe(25);
    expect(HealthcarePriorities.fromString('low')).toBe(10);
    expect(HealthcarePriorities.fromString('background')).toBe(1);
    expect(HealthcarePriorities.fromString('unknown')).toBe(25); // defaults to medium
  });

  test('should convert numeric priorities to string values', () => {
    expect(HealthcarePriorities.toString(100)).toBe('critical');
    expect(HealthcarePriorities.toString(85)).toBe('urgent');
    expect(HealthcarePriorities.toString(60)).toBe('high');
    expect(HealthcarePriorities.toString(30)).toBe('medium');
    expect(HealthcarePriorities.toString(15)).toBe('low');
    expect(HealthcarePriorities.toString(5)).toBe('background');
  });

  test('should handle edge cases in priority conversion', () => {
    expect(HealthcarePriorities.fromString('CRITICAL')).toBe(100); // case insensitive
    expect(HealthcarePriorities.toString(0)).toBe('background');
    expect(HealthcarePriorities.toString(1000)).toBe('critical');
  });
});