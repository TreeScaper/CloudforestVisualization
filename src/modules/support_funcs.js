/**
 * Utility function for drawing a rounded rectangle
 * @param {*} ctx 
 * @param {*} x 
 * @param {*} y 
 * @param {*} width 
 * @param {*} height 
 * @param {*} radius 
 */
const roundedRect = function (ctx, x, y, width, height, radius) {
    let r = new Path2D();
    r.moveTo(x, y + radius);
    r.lineTo(x, y + height - radius);
    r.arcTo(x, y + height, x + radius, y + height, radius);
    r.lineTo(x + width - radius, y + height);
    r.arcTo(x + width, y + height, x + width, y + height - radius, radius);
    r.lineTo(x + width, y + radius);
    r.arcTo(x + width, y, x + width - radius, y, radius);
    r.lineTo(x + radius, y);
    r.arcTo(x, y, x, y + radius, radius);
    ctx.fill(r);
}


export { roundedRect }