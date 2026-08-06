import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';

/**
 * Sanitize text input to prevent XSS attacks
 * Simple character-based approach with length limit (no ReDoS risk)
 */
function sanitizeText(text) {
  if (!text) return '';

  // Hard limit to prevent DoS (10,000 chars = ~2000 words)
  if (text.length > 10000) {
    text = text.substring(0, 10000);
  }

  // Simple character-by-character filtering (no regex)
  // Remove dangerous characters that could enable XSS
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    // Allow printable chars, newlines, tabs, but block <, >, & for HTML safety
    if (char === '<' || char === '>' || char === '&') {
      continue; // Skip these characters
    }
    result += char;
  }

  return result;
}

/**
 * Inline text editor that appears at the text position on canvas
 * PowerPoint-style bbox editing with multiline support
 */
const InlineTextEditor = forwardRef(function InlineTextEditor({
  text = '',
  x,
  y,
  fontSize,
  color,
  onSubmit,
  onCancel,
  onChange,
  onBlurStart, // Called immediately when blur starts (before submit delay)
  zoom = 1
}, ref) {
  const [value, setValue] = useState(text);
  const inputRef = useRef(null);
  const [inputWidth, setInputWidth] = useState(Math.max(200, text.length * fontSize * 0.6));
  const hasFocusedRef = useRef(false);

  // Expose blur method to parent via ref
  useImperativeHandle(ref, () => ({
    blur: () => {
      if (inputRef.current) {
        inputRef.current.blur();
      }
    }
  }), []);

  useEffect(() => {
    // Auto-focus and select all on mount - delay to avoid blur from canvas click
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        hasFocusedRef.current = true;
        if (text) {
          inputRef.current.select();
        }
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    // Auto-resize textarea width and height based on content
    if (inputRef.current && value) {
      const textarea = inputRef.current;

      // Reset height to calculate scrollHeight properly
      textarea.style.height = 'auto';

      // Set height based on content
      textarea.style.height = `${textarea.scrollHeight}px`;

      // Calculate width based on longest line
      const lines = value.split('\n');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.font = `${fontSize}px Comic Sans MS, cursive`;

      let maxWidth = 200;
      lines.forEach(line => {
        const metrics = ctx.measureText(line);
        maxWidth = Math.max(maxWidth, metrics.width + 20);
      });

      setInputWidth(Math.min(600, maxWidth)); // Cap at 600px
    }
  }, [value, fontSize]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      // Ctrl+Enter or Cmd+Enter to submit
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
    // Regular Enter adds new line (no special handling needed)
  };

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onSubmit(sanitizeText(trimmed));
    } else {
      onCancel(); // Cancel if empty
    }
  };

  const handleBlur = (e) => {
    // Only submit if we've actually focused the input (prevents immediate blur from canvas click)
    if (!hasFocusedRef.current) {
      return;
    }

    // Immediately signal that blur started (before the submit delay)
    // This prevents the canvas click that triggered blur from opening a new editor
    if (onBlurStart) {
      onBlurStart();
    }

    // Submit immediately (no delay needed - onBlurStart already prevents reopening)
    handleSubmit();
  };

  const handleChange = (e) => {
    const rawValue = e.target.value;
    const sanitized = sanitizeText(rawValue);
    setValue(sanitized);
    if (onChange) {
      onChange(sanitized);
    }
  };

  return (
    <textarea
      ref={inputRef}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      rows={1}
      style={{
        position: 'absolute',
        left: `${x}px`,
        top: `${y - fontSize}px`, // Position above baseline
        minWidth: '200px',
        maxWidth: '600px',
        width: `${inputWidth}px`,
        fontSize: `${fontSize * zoom}px`,
        fontFamily: 'Comic Sans MS, cursive',
        color: color,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        border: '2px solid var(--coral)',
        borderRadius: '4px',
        padding: '4px 6px',
        outline: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        zIndex: 10000,
        transform: `scale(${1/zoom})`, // Counteract zoom
        transformOrigin: 'top left',
        resize: 'none',
        overflow: 'hidden',
        lineHeight: '1.2',
      }}
    />
  );
});

export default InlineTextEditor;
