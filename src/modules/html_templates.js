/**
 * @param {String} HTML representing a single element
 * @return {Element}
 */
function htmlToElement(html) {
    var template = document.createElement('template');
    html = html.trim();
    template.innerHTML = html;
    return template.content.firstChild;
}

/**
 * var td = htmlToElement('<td>foo</td>'),
    div = htmlToElement('<div><span>nested</span> <span>stuff</span></div>');
 */

export { htmlToElement }