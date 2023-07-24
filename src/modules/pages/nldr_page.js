// Module for parsing and plotting NLDR coordinate data.
import * as Plotly2D from 'plotly.js-basic-dist';
import * as Plotly3D from 'plotly.js-gl3d-dist';
import * as PlotlyParallel from 'plotly.js-gl2d-dist';
import {
    htmlToElement,
    cleanExistingPlot
} from '../utilities/html_templates';

import {
    nldr_clean_data,
    assign_colors,
    plot_dimensions,
    color_list,
    clean_it,
    subtree_by_index,
    subtree_by_file,
    subtree_every_nth
} from '../components/nldr_plotting_core.js';
import { build_event } from "../utilities/support_funcs";
import { get_file_contents } from "../data_manager";

let coordinate_data = undefined;
let subtree_by_index_string = undefined;


/**
 * Create user controls for sub-tree loading and marking.
 *  - User can load a file with tree indexes marking subtrees
 *  - User can type the contents of the above file
 *  - User can request a consistent offset: every n trees generates a new group
 *  - Users can determine color overriding defaults.
 */
const build_subtree_menu = function(dimension) {
    let div_slug = `
    <div class="tile is-parent">
        <div class="tile is-child box">
            <div class="select">
                <select id="subtree-select">
                    <option value="clear-controls">Subset Plot</option>
                    <option value="every-nth">Every Nth Trees</option>
                    <option value="enter-indexes">Enter Tree Indexes</option>
                    <option value="load-index-file">Load Index File</option>
                </select>
            <div>
        </div>
    </div>
    `;

    document.getElementById("subset-plots-div").append(htmlToElement(div_slug));
    document.getElementById("subtree-select").addEventListener('change', e=>{
        if (e.target.value === "clear-controls") {
            clean_it();
        }
        if (e.target.value === "every-nth") {
            clean_it();
            subtree_every_nth(dimension, coordinate_data);
        }
        if (e.target.value === "enter-indexes") {
            clean_it();
            subtree_by_index(dimension, subtree_by_index_string, coordinate_data);
        }
        if (e.target.value === "load-index-file") {
            clean_it();
            subtree_by_file(dimension, coordinate_data);
        }
    });
}

const nldr_page_init = function () {

    //User has requested that CD groups be used in plotting.
    //Transform cd groups into string and place in the existing Subset Trees by Index text box.
    //Key: tree index Value: community index
    addEventListener("CDByTree", e => {
        let cd_groups = e.detail.groups;
        let trees_by_groups = Object.values(cd_groups).reduce((a,b) => (a[b]=[], a), {});
        Object.keys(cd_groups).forEach(k => {
            trees_by_groups[cd_groups[k]].push(Number(k) + 1); //These are offset indexes. Change to tree number 1...n
        });
        let str = '';
        let c = assign_colors({"colors": color_list, "default_color": 'lightblue'})
        let current_color = c.assign_color();

        //Sorted desc number of nodes per group
        let sorted_keys = Object.keys(trees_by_groups).sort((a,b) => {return trees_by_groups[b].length - trees_by_groups[a].length});
        sorted_keys.forEach(grp_num => {  
            str += `[${trees_by_groups[grp_num].join()}: ${current_color}];`;
            current_color = c.assign_color();
        });
        str = str.slice(0,-1);
        subtree_by_index_string = str;
    });
    //User has requested that CD groups _not_ be used in plotting.
    addEventListener("RemoveCDPlotting", e => {
        subtree_by_index_string = undefined;
    });

    addEventListener("NLDRPageRequest", e => {
        get_file_contents(Object.entries(e.detail.file_ids).map(entry => entry[1]), (contents) => {
            coordinate_data = nldr_clean_data(contents);
            let plot_dimension = coordinate_data[Object.keys(coordinate_data)[0]][0].length;
            cleanExistingPlot();
            build_subtree_menu(plot_dimension);
            plot_dimensions(plot_dimension, coordinate_data[Object.keys(coordinate_data)[0]]);
        });
    });
}

export {
    nldr_page_init
};
