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

const build_event = function (name, details) {
    return new CustomEvent(name, {
        bubbles: true,
        detail: details
    });
}

/**
 * Check if two sets are equal
 *
 * @param {Object} a Set A
 * @param {Object} b Set B
 */
const set_equality = function(a, b) {
    if (a.size !== b.size) {
        return false;
    }
    for (const e of a) {
        if (!b.has(e)) {
            return false;
        }
    }
    return true;
}

/**
 * Set background for canvas elements
 *
 * @param {string} canvas_id ID of the canvas element
 */
const set_background = function(canvas_id) {
    let canvas = document.getElementById(canvas_id);
    let ctx = undefined;
    if (canvas != null) {
        ctx = canvas.getContext('2d');
        //ctx.globalCompositeOperation = 'destination-over'
        ctx.fillStyle = "white";
        ctx.globalAlpha = 1.0;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

export {
    set_equality,
    roundedRect,
    build_event
}
