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

function removeChildNodes(parent_id) {
    let node = document.getElementById(parent_id);

    while (node.hasChildNodes()) {
        node.removeChild(node.lastChild);
    }

}

function cleanExistingPlot() {
    removeChildNodes("plot");
    removeChildNodes("plot-controls");
}
export { htmlToElement, removeChildNodes, cleanExistingPlot }