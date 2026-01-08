// Morphological operations utilities for DTM filtering

/**
 * Sliding window min/max filter using deque (double-ended queue) algorithm
 * Efficient O(n) per dimension for window size w
 */
export class Deque {
  private items: number[] = [];
  private indices: number[] = [];

  constructor(private isMax: boolean = false) {}

  clear(): void {
    this.items = [];
    this.indices = [];
  }

  push(value: number, index: number): void {
    if (this.isMax) {
      // For max: remove all smaller values from the back
      while (this.items.length > 0 && this.items[this.items.length - 1] < value) {
        this.items.pop();
        this.indices.pop();
      }
    } else {
      // For min: remove all larger values from the back
      while (this.items.length > 0 && this.items[this.items.length - 1] > value) {
        this.items.pop();
        this.indices.pop();
      }
    }
    this.items.push(value);
    this.indices.push(index);
  }

  removeOutOfWindow(windowLeft: number): void {
    // Remove elements from the front that are outside the window boundary
    while (this.indices.length > 0 && this.indices[0] < windowLeft) {
      this.items.shift();
      this.indices.shift();
    }
  }

  front(): number {
    if (this.items.length === 0) {
      return this.isMax ? -Infinity : Infinity;
    }
    return this.items[0];
  }
}

/**
 * 1D sliding window min/max filter using deque
 * @param data Input array
 * @param windowSize Window size (must be odd)
 * @param isMax If true, compute max filter; otherwise min filter
 * @returns Filtered array
 */
export function slidingWindowFilter(
  data: Float32Array | number[],
  windowSize: number,
  isMax: boolean = false
): Float32Array {
  const n = data.length;
  const halfWindow = Math.floor(windowSize / 2);
  const result = new Float32Array(n);
  const deque = new Deque(isMax);

  // Process all elements with sliding window
  for (let i = 0; i < n; i++) {
    // Window for position i is [i - halfWindow, i + halfWindow]
    // Remove elements that are outside the left boundary of the current window
    const windowLeft = i - halfWindow;
    deque.removeOutOfWindow(windowLeft);

    // Add current element to the deque
    deque.push(data[i], i);

    // The front of deque contains the min/max of the current window
    result[i] = deque.front();
  }

  return result;
}

/**
 * 2D morphological erosion (min filter)
 * @param data 2D array (row-major)
 * @param width Image width
 * @param height Image height
 * @param windowSize Window size (must be odd)
 * @returns Eroded array
 */
export function erosion2D(
  data: Float32Array,
  width: number,
  height: number,
  windowSize: number
): Float32Array {
  const result = new Float32Array(data.length);
  const temp = new Float32Array(data.length);

  // Apply 1D min filter along rows
  for (let y = 0; y < height; y++) {
    const rowStart = y * width;
    const row = data.subarray(rowStart, rowStart + width);
    const filtered = slidingWindowFilter(row, windowSize, false);
    temp.set(filtered, rowStart);
  }

  // Apply 1D min filter along columns
  for (let x = 0; x < width; x++) {
    const col = new Float32Array(height);
    for (let y = 0; y < height; y++) {
      col[y] = temp[y * width + x];
    }
    const filtered = slidingWindowFilter(col, windowSize, false);
    for (let y = 0; y < height; y++) {
      result[y * width + x] = filtered[y];
    }
  }

  return result;
}

/**
 * 2D morphological dilation (max filter)
 * @param data 2D array (row-major)
 * @param width Image width
 * @param height Image height
 * @param windowSize Window size (must be odd)
 * @returns Dilated array
 */
export function dilation2D(
  data: Float32Array,
  width: number,
  height: number,
  windowSize: number
): Float32Array {
  const result = new Float32Array(data.length);
  const temp = new Float32Array(data.length);

  // Apply 1D max filter along rows
  for (let y = 0; y < height; y++) {
    const rowStart = y * width;
    const row = data.subarray(rowStart, rowStart + width);
    const filtered = slidingWindowFilter(row, windowSize, true);
    temp.set(filtered, rowStart);
  }

  // Apply 1D max filter along columns
  for (let x = 0; x < width; x++) {
    const col = new Float32Array(height);
    for (let y = 0; y < height; y++) {
      col[y] = temp[y * width + x];
    }
    const filtered = slidingWindowFilter(col, windowSize, true);
    for (let y = 0; y < height; y++) {
      result[y * width + x] = filtered[y];
    }
  }

  return result;
}

/**
 * 2D morphological opening: erosion followed by dilation
 * @param data 2D array (row-major)
 * @param width Image width
 * @param height Image height
 * @param windowSize Window size (must be odd)
 * @returns Opened array
 */
export function opening2D(
  data: Float32Array,
  width: number,
  height: number,
  windowSize: number
): Float32Array {
  const eroded = erosion2D(data, width, height, windowSize);
  return dilation2D(eroded, width, height, windowSize);
}

