// Module for parsing and plotting NLDR coordinate data.
import {
    htmlToElement,
    cleanExistingPlot
} from '../utilities/html_templates';
import { PhylogramPlot } from "../components/phylogram_plot.js"
import {
    nldr_clean_data,
    assign_colors,
    plot_dimensions,
    parse_subset_string,
    color_list,
    clean_it
} from '../components/nldr_plotting_core.js';
import { get_file_contents, get_input_hcontent } from "../data_manager";
import * as constants from "../utilities/constants";

let coordinate_data = undefined;
let subtree_by_index_string = undefined;
let fall_back_color = "black";

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

/*
 * This color-codes scatter data where every nth point shares the same color.
 */
const plot_every_nth = function(cut_off, dimension, coordinate_data) {

    let c = assign_colors({"colors": color_list, "default_color": fall_back_color})
    let d = coordinate_data[Object.keys(coordinate_data)[0]];
    let colors = [];
    let current_color = undefined;
    d.forEach((v, idx) => {
        if (idx % cut_off === 0) {
            current_color = c.assign_color();
        }
        colors.push(current_color);
    });
    cleanExistingPlot();
    build_subtree_menu(dimension);
    plot_dimensions(dimension, d, colors);
}

/**
 * User wishes to subset the NLDR trees every nth number of trees.
 *
 * Draw gui, let user enter nth value, execute
 */
const subtree_every_nth = function(dimension, coordinate_data) {
    let s = `
    <div id="user-plot-ctrls" class="tile is-parent">
        <div class="tile is-child box>
            <label for="nth-value">Subset Trees every Nth Tree</label>
            <input id="nth-value" class="input" type="text" placeholder="10">
            <button id="execute-nth-value" class="button is-small">Execute</button>
        </div>
    </div>`;
    document.getElementById('subset-plots-div').append(htmlToElement(s));

    document.getElementById('execute-nth-value').addEventListener('click', e => {
        let el = document.getElementById("nth-value");
        if (el.value.length > 0) {
            plot_every_nth(Number(el.value), dimension, coordinate_data);
        }
    });
}


/**
 * User wishes to subset the NLDR trees by sepcific indexes.
 *
 * Draw gui, let user enter indexes, execute
 */
const subtree_by_index = function(dimension, pattern_string, coordinate_data) {
    let s = `
    <div id="user-plot-ctrls" class="tile is-parent">
        <div class="tile is-child box>
            <label for="nth-value">Subset Trees by Index <p class="is-size-7">Group with brackets <strong>[]</strong> - Separate with semicolons <strong>;</strong></p></label>
            <input id="nth-value" class="input" type="text" placeholder="[1-50: blue];[60-200: green] ;[300,301,302: yellow]" size="40">
            <button id="execute-index-string" class="button is-small">Execute</button>
        </div>
    </div>`;

    document.getElementById('subset-plots-div').append(htmlToElement(s));
    if (pattern_string) {
        document.getElementById('nth-value').value = pattern_string;
    }
    document.getElementById('execute-index-string').addEventListener('click', e => {
        let el = document.getElementById("nth-value");
        if (el.value.length > 0) {
            let d = coordinate_data[Object.keys(coordinate_data)[0]];
            let colors = parse_subset_string(el.value, d.length)
            cleanExistingPlot();
            build_subtree_menu(dimension);
            plot_dimensions(dimension, d, colors);
        }
    });
}

/**
 * User wishes to load a text file for creating subsets of trees.
 */
const subtree_by_file = function (dimension, coordinate_data) {
    let s = `
    <div id="user-plot-ctrls" class="tile is-parent">
        <div class="tile is-child box>
            <label for="subset-tree-file">Choose a text file to upload:</label>
            <input type="file" id="subset-tree-file" name="subset-tree-file" accept="text/plain">
        </div>
    </div>`;

    document.getElementById('subset-plots-div').append(htmlToElement(s));
    document.getElementById('subset-tree-file').addEventListener('change', e => {
        let file = e.target.files[0];
        let reader = new FileReader();
        reader.readAsText(file);
        reader.onload = function() {
            console.log(reader.result);
            let d = coordinate_data[Object.keys(coordinate_data)[0]];
            let colors = parse_subset_string(reader.result, d.length)
            cleanExistingPlot();
            build_subtree_menu(dimension);
            plot_dimensions(dimension, d, colors);
        }
        reader.onerror = function() {
            console.error(reader.error);
        }
    });

}

const determine_default_nldr_files = function(files) {

    // Find the NLDR coordinate history item.
    let nldr_coord_hcontent = files.filter(obj => obj.extension === 'cloudforest.coordinates')[0];
    if (nldr_coord_hcontent === undefined) {
        return undefined;
    }

    // Find the original tree file used to generate the NDLR coordinates.
    let distance_matrix_hcontent = get_input_hcontent(nldr_coord_hcontent, files);
    let trees_hcontent = get_input_hcontent(distance_matrix_hcontent, files);

    return {
        'nldr_coordinates': nldr_coord_hcontent,
        'tree_file': trees_hcontent
    }
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

            let coordinate_file_obj = contents.filter(file_object => file_object.fileExt === 'cloudforest.coordinates')[0];
            let tree_file_obj = contents.filter(file_object => file_object.fileExt === 'cloudforest.trees')[0];

            let node_click_function = function (data) {
                let plot_element = document.getElementById(constants.plot_id);

                let plot_element_children = Array.from(plot_element.children);
                let old_tree_plot_element = plot_element_children.find((element) => element.id == 'tree-plot');
                let new_tree_plot_element = document.createElement('div');
                new_tree_plot_element.setAttribute('id', 'tree-plot');

                if (old_tree_plot_element !== undefined) {
                    old_tree_plot_element.replaceWith(new_tree_plot_element)
                    let tree_controls_element = document.getElementById(constants.tree_controls_id);
                    if (tree_controls_element !== null) {
                        tree_controls_element.remove();
                    }
                }  else {
                    plot_element.append(new_tree_plot_element);
                }

                let tree_idx = data.points[0]['pointNumber'];
                let phylogram_plot = new PhylogramPlot({"boottree_data": tree_file_obj.data}, tree_idx + 1);
            }

            coordinate_data = nldr_clean_data(coordinate_file_obj);
            let plot_dimension = coordinate_data[Object.keys(coordinate_data)[0]][0].length;
            cleanExistingPlot();
            build_subtree_menu(plot_dimension);
            plot_dimensions(plot_dimension, coordinate_data[Object.keys(coordinate_data)[0]], ['blue'], node_click_function);
        });
    });
}

export {
    nldr_page_init,
    determine_default_nldr_files
};
