import { removeChildNodes, cleanExistingPlot, htmlToElement } from "./html_templates";
import { newick_parse as parseNewick } from "./tree_data_parsing"

let event_build_fn = undefined;

const animate = function (data) {

    let tree_num = 0;
    let parsed_branchset = parseNewick(data[tree_num]);
    cleanExistingPlot();
    dispatchEvent(event_build_fn("PlotForTree", {
        tree_num: 1,
        tree: parsed_branchset,
        width: document.getElementById("plot").clientWidth,
        height: .75 * document.getElementById("plot").clientWidth,
        plot_div: "plot"
    }));

    const control_div = document.getElementById("plot-controls");
    control_div.classList.add("box");
    control_div.append(htmlToElement(`
    <div class="field"><div class="control"><label for="boottree-slider">Tree Number: <span id="boottree-number">1</span></label>
    <input type="range" id="boottree-slider" name="boottree"
    min="1" max="${data.length - 1}" step="1" value="1" style="width: 60em;"></div></div>`));

    document.getElementById("boottree-slider").addEventListener("input", () => {
        let tn = Number(document.getElementById("boottree-slider").value);
        document.getElementById("boottree-number").textContent = tn;
        removeChildNodes("plot");
        let pn = parseNewick(data[tn - 1]);
        dispatchEvent(event_build_fn("PlotForTree", {
            tree: pn,
            tree_num: tn,
            width: document.getElementById("plot").clientWidth,
            height: .75 * document.getElementById("plot").clientWidth,
            plot_div: "plot"
        }));
    });
}

const hierarchy_plot_init = function (init_obj) {
    let { guid_fn, event_fn } = init_obj;
    event_build_fn = event_fn;
    const my_guid = guid_fn();

    addEventListener("TreeFileContents", e => {
        if (e.detail.guid === my_guid) {
            e.detail.contents.forEach(item => {
                if (/consensus tree/i.test(item.fileName)) {
                    let parsed_branchset = parseNewick(item.data);
                    cleanExistingPlot();

                    dispatchEvent(event_build_fn("PlotForTree", {
                        tree_num: undefined,
                        tree: parsed_branchset,
                        width: document.getElementById("plot").clientWidth,
                        height: .75 * document.getElementById("plot").clientWidth,
                        plot_div: "plot"
                    }));
                } else 
                {
                    animate(item.data.split(';')); //data string of trees into an array.    
                }
            })

        }
    });

    addEventListener("TreePlotRequest", e => {
        dispatchEvent(event_build_fn("TreeFileContentsRequest", { guid: my_guid, files: [e.detail.file_id] }));
    });

}

export { hierarchy_plot_init }