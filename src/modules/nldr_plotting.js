// Module for parsing and plotting NLDR coordinate data.
import * as Plotly2D from 'plotly.js-basic-dist';
import * as Plotly3D from 'plotly.js-gl3d-dist';
import * as PlotlyParallel from 'plotly.js-gl2d-dist';
import {
    htmlToElement,
    cleanExistingPlot
} from './html_templates';

import {
    nldr_clean_data,
    assign_colors,
    plot_dimensions
} from './nldr_plotting_core.js';
import { build_event } from "./support_funcs";

let coordinate_data = undefined;
let subtree_by_index_string = undefined;


const nldr_plot_init = function (init_obj) {
    let { guid_fn } = init_obj;
    const my_guid = guid_fn();

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

    addEventListener("FileContents", e => {
        if (e.detail.guid === my_guid) {
            coordinate_data = nldr_clean_data(e.detail.contents);
            let plot_dimension = coordinate_data[Object.keys(coordinate_data)[0]][0].length;
            cleanExistingPlot();
            plot_dimensions(plot_dimension, coordinate_data[Object.keys(coordinate_data)[0]]);
        }
    });

    addEventListener("NLDRPlotRequest", e => {
        dispatchEvent(build_event("FileContentsRequest", {
            guid: my_guid,
            files: [e.detail.file_id]
        }));
    });

}

export {
    nldr_plot_init
};
