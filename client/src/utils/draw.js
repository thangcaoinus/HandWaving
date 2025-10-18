// Draws a line segment with configurable dash pattern, cap, and join styles.
// Width is zoom-compensated to maintain visual thickness at all zoom levels.
export function drawLine(start, end, ctx, config, zoomLevel = 1) {
    if (start === null || end === null) return;

    const { color, width, lineDash = 'solid', lineCap = 'round', lineJoin = 'round' } = config;

    const offsetx = 0;
    const offsety = 0;

    ctx.beginPath();
    ctx.moveTo(start.x + offsetx, start.y + offsety);
    ctx.lineTo(end.x + offsetx, end.y + offsety);
    ctx.strokeStyle = color;
    ctx.lineWidth = width / zoomLevel;
    
    // Apply line dash pattern
    if (lineDash === 'dashed') {
        ctx.setLineDash([10, 5]);
    } else if (lineDash === 'dotted') {
        ctx.setLineDash([2, 3]);
    } else {
        ctx.setLineDash([]);
    }
    
    // Apply line cap and join
    ctx.lineCap = lineCap;
    ctx.lineJoin = lineJoin;
    
    ctx.stroke();
    ctx.closePath();
}
