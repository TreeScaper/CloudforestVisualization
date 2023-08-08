/**
 * Utility function for drawing a rounded rectangle
 * @param {*} ctx 
 * @param {*} x 
 * @param {*} y 
 * @param {*} width 
 * @param {*} height 
 * @param {*} radius 
 */

import * as constants from "../utilities/constants";

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
const set_background = function(ctx, width, height) {
    //ctx.globalCompositeOperation = 'destination-over'
    ctx.fillStyle = "white";
    ctx.globalAlpha = 1.0;
    ctx.fillRect(0, 0, width, height);
}

/**
 * Creates 2d array from tab-separated data.
 *
 * @param {string} data Raw data
 */
const parse_tsv = function(data) {
    let t_arr = data.split('\n');
    let arr = []
    t_arr.forEach(d => {
        if (d.length > 0) {
            arr.push(d.split('\t'));
        }
    });
    return arr;
}

const clear_plot = function() {
    let plot_element = document.getElementById(constants.plot_id);
    while (plot_element.firstChild) {
        plot_element.removeChild(plot_element.firstChild);
    }
}

export {
    clear_plot,
    parse_tsv,
    set_background,
    set_equality,
    roundedRect,
    build_event
}
