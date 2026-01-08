// DTM Filter Processing Logic
// This file contains the core processing logic that can be used both in worker and inline

import {
  opening2D,
} from './morphologyUtils';
import type {
  DTMFilterConfig,
  ProcessingProgress,
} from './types';

/**
 * Progressive Morphological Filter (PMF) for DTM extraction
 */
export function applyDTMFilter(
  data: Float32Array,
  width: number,
  height: number,
  config: DTMFilterConfig,
  progressCallback?: (progress: ProcessingProgress) => void
): Float32Array {
  const {
    sensitivityMultiplier,
    numberOfIterations,
    baseThreshold,
    slopeFactor,
    wMin,
    wMax,
  } = config;

  // Create a copy of the input data
  let dtm = new Float32Array(data);

  // Calculate cell size (assuming square pixels)
  // Use pixel scale from georeferencing if available
  const cellSize = 1.0; // Default, should be calculated from georeferencing

  // Generate window sizes for iterations
  const windowSizes: number[] = [];
  const step = Math.max(1, Math.floor((wMax - wMin) / numberOfIterations));
  
  for (let w = wMin; w <= wMax; w += step) {
    if (w % 2 === 1) {
      // Ensure odd window size
      windowSizes.push(w);
    }
  }

  // If we have fewer sizes than iterations, add more
  while (windowSizes.length < numberOfIterations && windowSizes.length > 0) {
    const last = windowSizes[windowSizes.length - 1];
    if (last + 2 <= wMax) {
      windowSizes.push(last + 2);
    } else {
      break;
    }
  }

  const totalSteps = windowSizes.length;

  // Process each window size
  for (let iter = 0; iter < windowSizes.length; iter++) {
    const windowSize = windowSizes[iter];

    // Report progress
    if (progressCallback) {
      progressCallback({
        current: iter + 1,
        total: totalSteps,
        percentage: Math.round(((iter + 1) / totalSteps) * 100),
        stage: `Processing window size ${windowSize}x${windowSize}`,
      });
    }

    // Compute opening (erosion followed by dilation)
    const opening = opening2D(dtm, width, height, windowSize);

    // Compute difference: d = Z - opening
    const difference = new Float32Array(dtm.length);
    for (let i = 0; i < dtm.length; i++) {
      difference[i] = dtm[i] - opening[i];
    }

    // Compute threshold: T = sensitivity * (baseThreshold + slopeFactor * w * cellSize)
    const threshold = sensitivityMultiplier * (baseThreshold + slopeFactor * windowSize * cellSize);

    // Apply filter: where d > T, clamp Z to min(Z, opening + T)
    for (let i = 0; i < dtm.length; i++) {
      if (difference[i] > threshold) {
        // This pixel is likely non-ground (vegetation/building)
        // Clamp it to the ground surface estimate
        dtm[i] = Math.min(dtm[i], opening[i] + threshold);
      }
    }
  }

  return dtm;
}












