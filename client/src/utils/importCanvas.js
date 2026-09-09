import { validTextState } from '../../../shared/textBox';
import { validImageState } from '../../../shared/imageObject';
import { refreshTextBounds } from './textBbox';
import { refreshImageBounds } from './imageBbox';
/**
 * Import canvas from JSON file
 * Validates structure and merges strokes into existing canvas
 */

// Validation helpers
function validateColor(color) {
  if (typeof color !== 'string') return false;
  // Allow hex colors only
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

function validateWidth(width) {
  return typeof width === 'number' && isFinite(width) && width >= 1 && width <= 50;
}

function validateShape(shape) {
  if (!shape || typeof shape !== 'string') return false;
  const validShapes = ['line', 'circle', 'rectangle', 'triangle', 'arrow', 'curved-arrow'];
  return validShapes.includes(shape);
}

export function importFromJSON(file, onSuccess, onError) {
  if (!file) {
    onError?.('No file provided');
    return;
  }

  // Validate file type
  if (!file.name.endsWith('.json') && file.type !== 'application/json') {
    onError?.('Please select a valid JSON file');
    return;
  }

  // Validate file size (max 10MB)
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    onError?.('File is too large. Maximum size is 10MB');
    return;
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const jsonString = e.target.result;
      const data = JSON.parse(jsonString);

      // Validate structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid JSON structure');
      }

      if (!data.strokes || !Array.isArray(data.strokes)) {
        throw new Error('Missing or invalid strokes array');
      }

      // Validate version (future-proofing)
      if (data.version && data.version !== '1.0') {
        console.warn(`Importing from different version: ${data.version}`);
      }

      // Validate each stroke
      const validatedStrokes = [];
      const MAX_STROKES = 5000; // Generous limit
      const MAX_POINTS_PER_STROKE = 50000; // Detailed curves allowed
      const MAX_TOTAL_POINTS = 625000; // ~10MB memory (16 bytes per point)

      if (data.strokes.length > MAX_STROKES) {
        throw new Error(`Too many strokes. Maximum is ${MAX_STROKES}`);
      }

      let totalPoints = 0;

      for (const stroke of data.strokes) {
        if (stroke.type === 'text') {
          if (!validTextState(stroke)) throw new Error('Invalid text box in file');
          validatedStrokes.push(refreshTextBounds({ id: String(stroke.id || ''), type: 'text', text: stroke.text,
            x: stroke.x, y: stroke.y, fontSize: stroke.fontSize, config: structuredClone(stroke.config),
            attachedTo: typeof stroke.attachedTo === 'string' ? stroke.attachedTo : null }));
          continue;
        }
        if (stroke.type === 'image') {
          if (!validImageState(stroke)) throw new Error('Invalid image in file');
          validatedStrokes.push(refreshImageBounds({ id: String(stroke.id || ''), type: 'image', src: stroke.src,
            x: stroke.x, y: stroke.y, width: stroke.width, height: stroke.height,
            config: stroke.config ? structuredClone(stroke.config) : null,
            attachedTo: typeof stroke.attachedTo === 'string' ? stroke.attachedTo : null }));
          continue;
        }
        if (!stroke.points || !Array.isArray(stroke.points)) {
          console.warn('Skipping stroke without points:', stroke);
          continue;
        }

        if (stroke.points.length === 0) {
          console.warn('Skipping empty stroke:', stroke);
          continue;
        }

        if (stroke.points.length > MAX_POINTS_PER_STROKE) {
          console.warn(`Skipping stroke with too many points (${stroke.points.length}):`, stroke);
          continue;
        }

        // Track total points across all strokes
        totalPoints += stroke.points.length;
        if (totalPoints > MAX_TOTAL_POINTS) {
          throw new Error(`Total points exceeds limit. Maximum is ${MAX_TOTAL_POINTS} points (~10MB)`);
        }

        // Validate points structure
        const validPoints = stroke.points.every(
          p => p && 
          typeof p.x === 'number' && 
          typeof p.y === 'number' &&
          isFinite(p.x) && 
          isFinite(p.y) &&
          Math.abs(p.x) < 1000000 && 
          Math.abs(p.y) < 1000000
        );

        if (!validPoints) {
          console.warn('Skipping stroke with invalid points:', stroke);
          continue;
        }

        // Validate config values if present
        const config = stroke.config || {};
        const validatedConfig = {
          color: validateColor(config.color) ? config.color : '#000000',
          width: validateWidth(config.width) ? config.width : 2,
          lineDash: Array.isArray(config.lineDash) ? config.lineDash.filter(n => 
            typeof n === 'number' && isFinite(n) && n >= 0 && n <= 100
          ).slice(0, 10) : [],
          lineCap: ['butt', 'round', 'square'].includes(config.lineCap) ? config.lineCap : 'round',
          lineJoin: ['miter', 'round', 'bevel'].includes(config.lineJoin) ? config.lineJoin : 'round',
        };

        // Sanitize ID to prevent XSS
        const sanitizedId = stroke.id 
          ? String(stroke.id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100)
          : `imported_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

        validatedStrokes.push({
          id: sanitizedId || `imported_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          points: stroke.points,
          config: validatedConfig,
          shape: validateShape(stroke.shape) ? stroke.shape : undefined,
          bbox: stroke.bbox || undefined,
        });
      }

      if (validatedStrokes.length === 0) {
        throw new Error('No valid strokes found in file');
      }

      // Success - return validated data
      onSuccess?.({
        strokes: validatedStrokes,
        viewport: data.viewport || null,
        metadata: {
          version: data.version,
          timestamp: data.timestamp,
          importedAt: new Date().toISOString(),
        },
      });

    } catch (error) {
      onError?.(error.message || 'Failed to parse JSON file');
    }
  };

  reader.onerror = () => {
    onError?.('Failed to read file');
  };

  reader.readAsText(file);
}

/**
 * Trigger file picker for JSON import
 */
export function triggerImportDialog(onSuccess, onError) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';

  input.onchange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      importFromJSON(file, onSuccess, onError);
    }
  };

  input.click();
}
